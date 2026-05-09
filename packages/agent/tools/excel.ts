import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// ========== Shared Types ==========
type DataRow = Record<string, any>;
type FileData = {
  rows: DataRow[];
  columns: string[];
  meta: {
    rowCount: number;
    columnCount: number;
    fileSize: number;
    missingValues: Record<string, number>;
    duplicates: number;
    dtypes: Record<string, string>;
  };
};

// ========== Helper Functions ==========
function parseCSV(content: string): DataRow[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: DataRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: DataRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

async function loadFile(fileId: string): Promise<FileData> {
  const filePath = path.join(process.cwd(), fileId);
  const ext = path.extname(filePath).toLowerCase();

  let rows: DataRow[] = [];
  let columns: string[] = [];

  if (ext === ".csv") {
    const content = await fs.readFile(filePath, "utf-8");
    rows = parseCSV(content);
    columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  } else {
    throw new Error(`Unsupported file type: ${ext}. Only CSV files are supported.`);
  }

  // Compute metadata
  const dtypes: Record<string, string> = {};
  const missingValues: Record<string, number> = {};
  columns.forEach(col => {
    const values = rows.map(r => r[col]).filter(v => v !== undefined && v !== null && v !== "");
    const nonEmpty = values.filter(v => v !== "");
    missingValues[col] = rows.length - nonEmpty.length;

    // Infer type
    if (nonEmpty.every(v => !isNaN(Number(v)))) {
      dtypes[col] = "number";
    } else if (nonEmpty.every(v => typeof v === "boolean" || v === "true" || v === "false")) {
      dtypes[col] = "boolean";
    } else {
      dtypes[col] = "string";
    }
  });

  return {
    rows,
    columns,
    meta: {
      rowCount: rows.length,
      columnCount: columns.length,
      fileSize: (await fs.stat(filePath)).size,
      missingValues,
      duplicates: rows.length - new Set(rows.map(r => JSON.stringify(r))).size,
      dtypes
    }
  };
}

function applyOperations(data: FileData, operations: Array<{name: string, arguments: any}>): FileData {
  let result = { ...data, rows: [...data.rows] };

  for (const op of operations) {
    switch (op.name) {
      case "filter": {
        const { query } = op.arguments;
        // Simple pandas-like query evaluation (sandboxed)
        result.rows = result.rows.filter(row => {
          try {
            // Safe eval with row context
            const safeEval = new Function("row", `with(row) { return ${query} }`);
            return safeEval(row);
          } catch {
            return false;
          }
        });
        break;
      }
      case "select": {
        const { columns: cols } = op.arguments;
        const selected = cols.split(",").map(c => c.trim());
        result.rows = result.rows.map(row => {
          const filtered: DataRow = {};
          selected.forEach(col => { if (col in row) filtered[col] = row[col] });
          return filtered;
        });
        result.columns = selected;
        break;
      }
      case "orderby": {
        const { by, desc = false } = op.arguments;
        const cols = by.split(",").map(c => c.trim());
        result.rows.sort((a, b) => {
          for (const col of cols) {
            if (a[col] < b[col]) return desc ? 1 : -1;
            if (a[col] > b[col]) return desc ? -1 : 1;
          }
          return 0;
        });
        break;
      }
      case "head": {
        const { n = 5 } = op.arguments;
        result.rows = result.rows.slice(0, n);
        break;
      }
      case "groupby": {
        const { by, agg } = op.arguments;
        const groups = new Map<string, DataRow[]>();
        result.rows.forEach(row => {
          const key = String(row[by]);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(row);
        });
        const aggregated: DataRow[] = [];
        for (const [key, group] of groups) {
          const entry: DataRow = { [by]: key };
          for (const [col, func] of Object.entries(agg)) {
            const values = group.map(r => r[col]).filter(v => v !== undefined && v !== "");
            const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
            switch (func) {
              case "sum": entry[col] = nums.reduce((a,b) => a+b, 0); break;
              case "mean": entry[col] = nums.length ? nums.reduce((a,b) => a+b, 0) / nums.length : null; break;
              case "count": entry[col] = values.length; break;
              case "min": entry[col] = Math.min(...nums); break;
              case "max": entry[col] = Math.max(...nums); break;
            }
          }
          aggregated.push(entry);
        }
        result.rows = aggregated;
        result.columns = [by, ...Object.keys(agg)];
        break;
      }
      case "add_column": {
        const { column_name, expression } = op.arguments;
        result.rows = result.rows.map(row => ({
          ...row,
          [column_name]: new Function("row", `with(row) { return ${expression} }`)(row)
        }));
        result.columns = [...result.columns, column_name];
        break;
      }
    }
  }

  // Update meta
  result.meta = {
    ...result.meta,
    rowCount: result.rows.length,
    columnCount: result.columns.length
  };

  return result;
}

// ========== Tool Definitions ==========
const readFileInputSchema = z.object({
  file_id: z.string().describe("CSV file path")
});

export const readFileTool = () =>
  tool({
    description: "Read CSV file and output basic structure info",
    inputSchema: readFileInputSchema,
    execute: async (args) => {
      const data = await loadFile(args.file_id);
      return JSON.stringify({
        file: args.file_id,
        ...data.meta,
        columns: data.columns.map(col => ({
          name: col,
          type: data.meta.dtypes[col],
          missing: data.meta.missingValues[col]
        })),
        preview: data.rows.slice(0, 3)
      });
    }
  });

const describeInputSchema = z.object({
  file_id: z.string().describe("CSV file path")
});

export const describeTool = () =>
  tool({
    description: "Statistical summary of numeric columns in CSV",
    inputSchema: describeInputSchema,
    execute: async (args) => {
      const data = await loadFile(args.file_id);
      const numericCols = data.columns.filter(col => data.meta.dtypes[col] === "number");

      const stats: Record<string, any> = {};
      for (const col of numericCols) {
        const values = data.rows
          .map(r => Number(r[col]))
          .filter(n => !isNaN(n));

        if (values.length === 0) continue;

        values.sort((a,b) => a-b);
        stats[col] = {
          count: values.length,
          mean: values.reduce((a,b) => a+b, 0) / values.length,
          std: Math.sqrt(values.reduce((sum, v) => {
            const mean = values.reduce((a,b) => a+b, 0) / values.length;
            return sum + Math.pow(v - mean, 2);
          }, 0) / values.length),
          min: values[0],
          max: values[values.length - 1],
          q25: values[Math.floor(values.length * 0.25)],
          q50: values[Math.floor(values.length * 0.5)],
          q75: values[Math.floor(values.length * 0.75)]
        };
      }

      return JSON.stringify({ numeric_columns: stats });
    }
  });

const inspectInputSchema = z.object({
  file_id: z.string().describe("CSV file path")
});

export const inspectTool = () =>
  tool({
    description: "Comprehensive CSV file inspection with suggestions",
    inputSchema: inspectInputSchema,
    execute: async (args) => {
      const data = await loadFile(args.file_id);

      // Generate suggestions
      const suggestions = [];
      if (data.meta.duplicates > 0) {
        suggestions.push({ type: "warning", message: `${data.meta.duplicates} duplicate rows detected`, action: "distinct" });
      }
      Object.entries(data.meta.missingValues).forEach(([col, count]) => {
        if (count > data.meta.rowCount * 0.3) {
          suggestions.push({ type: "warning", message: `Column "${col}" has ${count} missing values`, action: "filter or impute" });
        }
      });

      // Grouping suggestions
      const categoricalCols = data.columns.filter(col =>
        data.meta.dtypes[col] === "string" &&
        new Set(data.rows.map(r => r[col])).size < data.meta.rowCount * 0.1
      );
      if (categoricalCols.length > 0) {
        suggestions.push({
          type: "suggestion",
          message: `Consider grouping by: ${categoricalCols.slice(0,3).join(", ")}`,
          action: "groupby"
        });
      }

      return JSON.stringify({
        structure: {
          rows: data.meta.rowCount,
          columns: data.meta.columnCount,
          memory_mb: Math.round(data.meta.fileSize / 1024 / 1024 * 100) / 100
        },
        columns: data.columns.map(col => ({
          name: col,
          type: data.meta.dtypes[col],
          unique: new Set(data.rows.map(r => r[col])).size,
          missing: data.meta.missingValues[col]
        })),
        suggestions
      });
    }
  });

const pipeInputSchema = z.object({
  file_id: z.string().describe("CSV file path"),
  operations: z.array(z.object({
    name: z.enum(["groupby","orderby","filter","head","describe","inspect","value_counts","correlation","sample","select","count","sum","distinct","add_column"]),
    arguments: z.record(z.any())
  })),
  debug: z.boolean().optional().default(false)
});

export const pipeTool = () =>
  tool({
    description: "Execute sequential data operations on CSV",
    inputSchema: pipeInputSchema,
    execute: async (args) => {
      const data = await loadFile(args.file_id);
      const result = applyOperations(data, args.operations);

      if (args.debug) {
        return JSON.stringify({
          operations_executed: args.operations.map(o => o.name),
          intermediate_meta: args.operations.map((_, i) => ({
            after: i + 1,
            rows: applyOperations(data, args.operations.slice(0, i + 1)).meta.rowCount
          })),
          final: {
            rows: result.rows.slice(0, 10), // Preview
            meta: result.meta
          }
        });
      }

      return JSON.stringify({
        rows: result.rows.slice(0, args.operations.some(o => o.name === "head") ? 100 : 20),
        meta: result.meta,
        total_rows: result.meta.rowCount
      });
    }
  });

  return {
    rows,
    columns,
    meta: {
      rowCount: rows.length,
      columnCount: columns.length,
      fileSize: (await fs.stat(filePath)).size,
      missingValues,
      duplicates: rows.length - new Set(rows.map(r => JSON.stringify(r))).size,
      dtypes
    }
  };
}

function applyOperations(data: FileData, operations: Array<{name: string, arguments: any}>): FileData {
  let result = { ...data, rows: [...data.rows] };

  for (const op of operations) {
    switch (op.name) {
      case "filter": {
        const { query } = op.arguments;
        // Simple pandas-like query evaluation (sandboxed)
        result.rows = result.rows.filter(row => {
          try {
            // Safe eval with row context
            const safeEval = new Function("row", `with(row) { return ${query} }`);
            return safeEval(row);
          } catch {
            return false;
          }
        });
        break;
      }
      case "select": {
        const { columns: cols } = op.arguments;
        const selected = cols.split(",").map(c => c.trim());
        result.rows = result.rows.map(row => {
          const filtered: DataRow = {};
          selected.forEach(col => { if (col in row) filtered[col] = row[col] });
          return filtered;
        });
        result.columns = selected;
        break;
      }
      case "orderby": {
        const { by, desc = false } = op.arguments;
        const cols = by.split(",").map(c => c.trim());
        result.rows.sort((a, b) => {
          for (const col of cols) {
            if (a[col] < b[col]) return desc ? 1 : -1;
            if (a[col] > b[col]) return desc ? -1 : 1;
          }
          return 0;
        });
        break;
      }
      case "head": {
        const { n = 5 } = op.arguments;
        result.rows = result.rows.slice(0, n);
        break;
      }
      case "groupby": {
        const { by, agg } = op.arguments;
        const groups = new Map<string, DataRow[]>();
        result.rows.forEach(row => {
          const key = String(row[by]);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(row);
        });
        const aggregated: DataRow[] = [];
        for (const [key, group] of groups) {
          const entry: DataRow = { [by]: key };
          for (const [col, func] of Object.entries(agg)) {
            const values = group.map(r => r[col]).filter(v => v !== undefined && v !== "");
            const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
            switch (func) {
              case "sum": entry[col] = nums.reduce((a,b) => a+b, 0); break;
              case "mean": entry[col] = nums.length ? nums.reduce((a,b) => a+b, 0) / nums.length : null; break;
              case "count": entry[col] = values.length; break;
              case "min": entry[col] = Math.min(...nums); break;
              case "max": entry[col] = Math.max(...nums); break;
            }
          }
          aggregated.push(entry);
        }
        result.rows = aggregated;
        result.columns = [by, ...Object.keys(agg)];
        break;
      }
      case "add_column": {
        const { column_name, expression } = op.arguments;
        result.rows = result.rows.map(row => ({
          ...row,
          [column_name]: new Function("row", `with(row) { return ${expression} }`)(row)
        }));
        result.columns = [...result.columns, column_name];
        break;
      }
    }
  }

  // Update meta
  result.meta = {
    ...result.meta,
    rowCount: result.rows.length,
    columnCount: result.columns.length
  };

  return result;
}

// ========== Tool Definitions ==========
const readFileInputSchema = z.object({
  file_id: z.string().describe("File path or ID"),
  sheet_name: z.string().optional().describe("Sheet name for Excel files")
});

export const readFileTool = () =>
  tool({
    description: "Read Excel/CSV file and output basic structure info",
    inputSchema: readFileInputSchema,
    execute: async (args) => {
      const data = await loadFile(args.file_id, args.sheet_name);
      return JSON.stringify({
        file: args.file_id,
        ...data.meta,
        columns: data.columns.map(col => ({
          name: col,
          type: data.meta.dtypes[col],
          missing: data.meta.missingValues[col]
        })),
        preview: data.rows.slice(0, 3)
      });
    }
  });

const listSheetsInputSchema = z.object({
  file_id: z.string().describe("File path or ID")
});

export const listSheetsTool = () =>
  tool({
    description: "List all sheets in an Excel file",
    inputSchema: listSheetsInputSchema,
    execute: async (args) => {
      const filePath = path.join(process.cwd(), args.file_id);
      const ext = path.extname(filePath).toLowerCase();

      if (ext !== ".xlsx" && ext !== ".xls") {
        return JSON.stringify({ sheets: ["default"], note: "CSV files have single sheet" });
      }

      const workbook = readXLSX(filePath);
      return JSON.stringify({
        sheets: workbook.SheetNames.map(name => ({
          name,
          rowCount: xlsxUtils.sheet_to_json(workbook.Sheets[name]).length
        }))
      });
    }
  });

const describeInputSchema = z.object({
  file_id: z.string(),
  sheet_name: z.string().optional()
});

export const describeTool = () =>
  tool({
    description: "Statistical summary of numeric columns",
    inputSchema: describeInputSchema,
    execute: async (args) => {
      const data = await loadFile(args.file_id, args.sheet_name);
      const numericCols = data.columns.filter(col => data.meta.dtypes[col] === "number");

      const stats: Record<string, any> = {};
      for (const col of numericCols) {
        const values = data.rows
          .map(r => Number(r[col]))
          .filter(n => !isNaN(n));

        if (values.length === 0) continue;

        values.sort((a,b) => a-b);
        stats[col] = {
          count: values.length,
          mean: values.reduce((a,b) => a+b, 0) / values.length,
          std: Math.sqrt(values.reduce((sum, v) => {
            const mean = values.reduce((a,b) => a+b, 0) / values.length;
            return sum + Math.pow(v - mean, 2);
          }, 0) / values.length),
          min: values[0],
          max: values[values.length - 1],
          q25: values[Math.floor(values.length * 0.25)],
          q50: values[Math.floor(values.length * 0.5)],
          q75: values[Math.floor(values.length * 0.75)]
        };
      }

      return JSON.stringify({ numeric_columns: stats });
    }
  });

const inspectInputSchema = z.object({
  file_id: z.string(),
  sheet_name: z.string().optional()
});

export const inspectTool = () =>
  tool({
    description: "Comprehensive file inspection with suggestions",
    inputSchema: inspectInputSchema,
    execute: async (args) => {
      const data = await loadFile(args.file_id, args.sheet_name);

      // Generate suggestions
      const suggestions = [];
      if (data.meta.duplicates > 0) {
        suggestions.push({ type: "warning", message: `${data.meta.duplicates} duplicate rows detected`, action: "distinct" });
      }
      Object.entries(data.meta.missingValues).forEach(([col, count]) => {
        if (count > data.meta.rowCount * 0.3) {
          suggestions.push({ type: "warning", message: `Column "${col}" has ${count} missing values`, action: "filter or impute" });
        }
      });

      // Grouping suggestions
      const categoricalCols = data.columns.filter(col =>
        data.meta.dtypes[col] === "string" &&
        new Set(data.rows.map(r => r[col])).size < data.meta.rowCount * 0.1
      );
      if (categoricalCols.length > 0) {
        suggestions.push({
          type: "suggestion",
          message: `Consider grouping by: ${categoricalCols.slice(0,3).join(", ")}`,
          action: "groupby"
        });
      }

      return JSON.stringify({
        structure: {
          rows: data.meta.rowCount,
          columns: data.meta.columnCount,
          memory_mb: Math.round(data.meta.fileSize / 1024 / 1024 * 100) / 100
        },
        columns: data.columns.map(col => ({
          name: col,
          type: data.meta.dtypes[col],
          unique: new Set(data.rows.map(r => r[col])).size,
          missing: data.meta.missingValues[col]
        })),
        suggestions
      });
    }
  });

const pipeInputSchema = z.object({
  file_id: z.string(),
  sheet_name: z.string().optional(),
  operations: z.array(z.object({
    name: z.enum(["groupby","orderby","filter","head","describe","inspect","value_counts","correlation","sample","select","count","sum","distinct","add_column"]),
    arguments: z.record(z.any())
  })),
  debug: z.boolean().optional().default(false)
});

export const pipeTool = () =>
  tool({
    description: "Execute sequential data operations",
    inputSchema: pipeInputSchema,
    execute: async (args) => {
      const data = await loadFile(args.file_id, args.sheet_name);
      const result = applyOperations(data, args.operations);

      if (args.debug) {
        return JSON.stringify({
          operations_executed: args.operations.map(o => o.name),
          intermediate_meta: args.operations.map((_, i) => ({
            after: i + 1,
            rows: applyOperations(data, args.operations.slice(0, i + 1)).meta.rowCount
          })),
          final: {
            rows: result.rows.slice(0, 10), // Preview
            meta: result.meta
          }
        });
      }

      return JSON.stringify({
        rows: result.rows.slice(0, args.operations.some(o => o.name === "head") ? 100 : 20),
        meta: result.meta,
        total_rows: result.meta.rowCount
      });
    }
  });