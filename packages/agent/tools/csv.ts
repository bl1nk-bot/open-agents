import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { getSandbox, toDisplayPath } from "./utils";
import {
  resolveSandboxRealPath,
  resolveWorkspacePath,
} from "./path-security";

const readCsvToolInputSchema = z.object({
  filePath: z
    .string()
    .describe("Workspace-relative path to CSV file (e.g., data.csv)"),
});

export const readCsvTool = () =>
  tool({
    description: `Read CSV file and return structured data.

WHEN TO USE:
- Reading CSV files for data analysis
- Getting preview of CSV file contents
- Understanding CSV file structure and metadata

WHEN NOT TO USE:
- Reading Excel files (.xlsx, .xls)
- Processing large files (use streaming approaches)
- Complex data transformations (use pipe operations)

USAGE:
- File must be in CSV format with comma-separated values
- First row is treated as headers
- Returns rows as objects with column headers as keys
- Includes basic metadata about the file

EXAMPLES:
- Read sales data: filePath: "sales/data.csv"
- Preview customer data: filePath: "customers.csv"`,
    inputSchema: readCsvToolInputSchema,
    execute: async ({ filePath }, { experimental_context }) => {
      const sandbox = await getSandbox(experimental_context, "read-csv");

      try {
        const workingDirectory = sandbox.workingDirectory;
        const absolutePath = resolveWorkspacePath(filePath, workingDirectory);

        if (!absolutePath) {
          return {
            success: false,
            error: `Invalid path: ${filePath}`,
          };
        }

        const realPath = await resolveSandboxRealPath({
          sandbox,
          absolutePath,
          workingDirectory,
        });

        // Check if file exists and is readable
        const stats = await fs.stat(realPath);
        if (stats.size > 10 * 1024 * 1024) { // 10MB limit
          return {
            success: false,
            error: "File too large (>10MB). Use streaming for large files.",
          };
        }

        const content = await fs.readFile(realPath, "utf-8");
        const lines = content.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
          return {
            success: true,
            data: [],
            metadata: {
              rowCount: 0,
              columnCount: 0,
              fileSize: stats.size,
            },
          };
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = [];

        for (let i = 1; i < Math.min(lines.length, 101); i++) { // Limit to 100 rows
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          rows.push(row);
        }

        return {
          success: true,
          data: rows,
          metadata: {
            rowCount: lines.length - 1,
            columnCount: headers.length,
            fileSize: stats.size,
            columns: headers,
            previewRows: rows.length,
            truncated: lines.length > 101,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to read CSV: ${message}`,
        };
      }
    },
  });

const analyzeCsvToolInputSchema = z.object({
  filePath: z
    .string()
    .describe("Workspace-relative path to CSV file"),
});

export const analyzeCsvTool = () =>
  tool({
    description: `Analyze CSV file structure and provide statistics.

WHEN TO USE:
- Understanding CSV file schema and data types
- Getting statistical summaries of numeric columns
- Identifying data quality issues (missing values, duplicates)

WHEN NOT TO USE:
- Reading actual data rows (use readCsvTool instead)
- Processing Excel files
- Complex data analysis requiring full dataset

USAGE:
- Analyzes column types (string/number/boolean)
- Counts missing values per column
- Provides basic statistics for numeric columns
- Detects duplicate rows
- Returns comprehensive file metadata

EXAMPLES:
- Analyze sales data: filePath: "sales/data.csv"
- Check data quality: filePath: "customers.csv"`,
    inputSchema: analyzeCsvToolInputSchema,
    execute: async ({ filePath }, { experimental_context }) => {
      const sandbox = await getSandbox(experimental_context, "analyze-csv");

      try {
        const workingDirectory = sandbox.workingDirectory;
        const absolutePath = resolveWorkspacePath(filePath, workingDirectory);

        if (!absolutePath) {
          return {
            success: false,
            error: `Invalid path: ${filePath}`,
          };
        }

        const realPath = await resolveSandboxRealPath({
          sandbox,
          absolutePath,
          workingDirectory,
        });

        const stats = await fs.stat(realPath);
        const content = await fs.readFile(realPath, "utf-8");
        const lines = content.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
          return {
            success: true,
            analysis: {
              structure: {
                rows: 0,
                columns: 0,
                fileSize: stats.size,
              },
              columns: [],
              issues: [],
            },
          };
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const dataRows = lines.slice(1);

        // Analyze columns
        const columnAnalysis = headers.map(header => {
          const values = dataRows
            .map(line => {
              const cols = line.split(',');
              const headerIndex = headers.indexOf(header);
              return headerIndex >= 0 ? cols[headerIndex]?.trim().replace(/"/g, '') : '';
            })
            .filter(v => v !== undefined && v !== '');

          const nonEmpty = values.filter(v => v !== '');
          const missing = values.length - nonEmpty.length;

          let type = 'string';
          if (nonEmpty.every(v => !isNaN(Number(v)))) {
            type = 'number';
          } else if (nonEmpty.every(v => v === 'true' || v === 'false')) {
            type = 'boolean';
          }

          return {
            name: header,
            type,
            total: values.length,
            missing,
            unique: new Set(nonEmpty).size,
          };
        });

        // Check for duplicates
        const uniqueRows = new Set(dataRows);
        const duplicates = dataRows.length - uniqueRows.size;

        // Numeric statistics
        const numericStats = columnAnalysis
          .filter(col => col.type === 'number')
          .map(col => {
            const values = dataRows
              .map(line => {
                const cols = line.split(',');
                const headerIndex = headers.indexOf(col.name);
                return headerIndex >= 0 ? cols[headerIndex]?.trim().replace(/"/g, '') : '';
              })
              .filter(v => v !== '' && !isNaN(Number(v)))
              .map(v => Number(v))
              .sort((a, b) => a - b);

            if (values.length === 0) return null;

            return {
              column: col.name,
              count: values.length,
              mean: values.reduce((a, b) => a + b, 0) / values.length,
              min: values[0],
              max: values[values.length - 1],
              median: values[Math.floor(values.length / 2)],
            };
          })
          .filter(Boolean);

        const issues = [];
        if (duplicates > 0) {
          issues.push({ type: 'warning', message: `${duplicates} duplicate rows detected` });
        }

        columnAnalysis.forEach(col => {
          if (col.missing > col.total * 0.3) {
            issues.push({
              type: 'warning',
              message: `Column "${col.name}" has ${col.missing} missing values (${Math.round(col.missing / col.total * 100)}%)`
            });
          }
        });

        return {
          success: true,
          analysis: {
            structure: {
              rows: dataRows.length,
              columns: headers.length,
              fileSize: stats.size,
              duplicates,
            },
            columns: columnAnalysis,
            numericStats,
            issues,
            suggestions: issues.length === 0 ? ['Data looks clean and ready for analysis'] : [],
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to analyze CSV: ${message}`,
        };
      }
    },
  });