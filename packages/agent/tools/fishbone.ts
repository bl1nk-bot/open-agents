import { tool } from "ai";
import { z } from "zod";

// ========== Fishbone Tool Schema ==========
const fishboneArgs = z.object({
  // Required: sequentialthinking interface
  thought: z.string().describe("Current thinking content"),
  nextThoughtNeeded: z.boolean().describe("Continue to next step?"),
  thoughtNumber: z.number().int().positive().describe("Current step number"),
  totalThoughts: z.number().int().positive().describe("Estimated total steps"),

  // Optional: Fishbone structure state
  fishbone: z.object({
    problem: z.string().optional(),
    categories: z.array(z.enum([
      "People", "Process", "Technology",
      "Environment", "Material", "Measurement"
    ])).optional(),
    currentCategory: z.string().optional(),
    hierarchy: z.object({
      mainCauses: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        category: z.string().optional(),
        subCauses: z.array(z.object({
          id: z.string().optional(),
          name: z.string(),
          rootCause: z.string().optional(),
          fiveWhys: z.array(z.string()).optional(),
          impactScore: z.object({
            severity: z.number().min(1).max(10).optional(),
            likelihood: z.number().min(1).max(10).optional(),
            priority: z.enum(["Critical", "High", "Medium", "Low"]).optional()
          }).optional()
        })).optional()
      })).optional()
    }).optional(),
    completedCategories: z.array(z.string()).optional()
  }).optional(),

  // Branching/revision support
  branchId: z.string().optional(),
  isRevision: z.boolean().optional(),
  revisesThought: z.number().int().positive().optional(),
  branchFromThought: z.number().int().positive().optional(),
  needsMoreThoughts: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export const fishboneTool = () =>
  tool({
    description: "Step-by-step root cause analysis using Fishbone Diagram. Returns structured analysis data. Call repeatedly with updated state until nextThoughtNeeded=false.",

    inputSchema: fishboneArgs,

    execute: async (args, context) => {
      const {
        thoughtNumber,
        totalThoughts,
        fishbone = {},
        nextThoughtNeeded,
        thought
      } = args;

      // Helper: Generate unique ID
      const generateId = (prefix: string) => `${prefix}-${thoughtNumber}-${Date.now().toString(36).slice(-4)}`;

      // 🎯 Step 1: Initialize
      if (thoughtNumber === 1 && !fishbone.problem) {
        return JSON.stringify({
          step: "initialize",
          message: "โครงสร้าง Fishbone พร้อมใช้งาน กำหนด fishbone.problem และ fishbone.categories เพื่อเริ่มวิเคราะห์",
          availableCategories: ["People", "Process", "Technology", "Environment", "Material", "Measurement"],
          nextThoughtNeeded: true,
          guidance: "Set fishbone.problem + fishbone.categories in next call"
        });
      }

      // 🗂️ Step 2: Category Selection
      if (thoughtNumber === 2 && !fishbone.currentCategory) {
        const available = (fishbone.categories || [])
          .filter((c: string) => !fishbone.completedCategories?.includes(c));

        return JSON.stringify({
          step: "category_selection",
          message: `เลือกหมวดหมู่เพื่อวิเคราะห์: ${available.join(", ")}`,
          availableCategories: available.map((cat: string) => ({
            id: cat.toLowerCase(),
            name: cat,
            description: `${cat} causes related to "${fishbone.problem}"`
          })),
          nextThoughtNeeded: true,
          guidance: "Set fishbone.currentCategory to begin analyzing a category"
        });
      }

      // 🔍 Step 3+: Hierarchical Building
      if (fishbone.currentCategory && thoughtNumber >= 3) {
        const hierarchy = fishbone.hierarchy || { mainCauses: [] };
        const currentMain = hierarchy.mainCauses?.find(
          (m: any) => m.category === fishbone.currentCategory && !m.subCauses?.some((s: any) => !s.rootCause)
        );

        // Prompt for main cause
        if (!currentMain) {
          return JSON.stringify({
            step: "add_main_cause",
            message: `หมวดหมู่: ${fishbone.currentCategory}\nเพิ่มสาเหตุหลัก`,
            category: fishbone.currentCategory,
            placeholder: "Enter main cause name...",
            nextThoughtNeeded: true,
            guidance: "Add main cause to fishbone.hierarchy.mainCauses array with id, name, category, and empty subCauses array"
          });
        }

        // Prompt for sub-cause
        const incompleteSub = currentMain.subCauses?.find((s: any) => !s.rootCause);
        if (incompleteSub) {
          return JSON.stringify({
            step: "five_whys_analysis",
            message: `สาเหตุย่อย: ${incompleteSub.name}\nใช้ 5 Whys เพื่อหาสาเหตุรากฐาน`,
            subCause: incompleteSub,
            questions: [
              "Why did this happen?",
              "Why did that occur?",
              "Why was that the case?",
              "Why didn't prevention work?",
              "Why is this the root?"
            ],
            nextThoughtNeeded: true,
            guidance: "Complete 5 Whys analysis and set rootCause for this sub-cause"
          });
        }

        // Category complete → move to next
        const allComplete = hierarchy.mainCauses?.every((m: any) =>
          m.category !== fishbone.currentCategory ||
          m.subCauses?.every((s: any) => s.rootCause && s.fiveWhys?.length >= 3)
        );

        if (allComplete) {
          const nextCat = (fishbone.categories || []).find(
            (c: string) => !fishbone.completedCategories?.includes(c) && c !== fishbone.currentCategory
          );

          return JSON.stringify({
            step: "category_complete",
            message: nextCat
              ? `✅ "${fishbone.currentCategory}" เสร็จสิ้น → ต่อไป: "${nextCat}"`
              : `✅ ทั้งหมดเสร็จสิ้น พร้อมสรุปผล`,
            completedCategory: fishbone.currentCategory,
            categoryCauses: hierarchy.mainCauses?.filter((m: any) => m.category === fishbone.currentCategory) || [],
            nextCategory: nextCat,
            nextThoughtNeeded: !!nextCat,
            fishbone: {
              ...fishbone,
              completedCategories: [...(fishbone.completedCategories || []), fishbone.currentCategory],
              currentCategory: nextCat || undefined
            }
          });
        }
      }

      // 🏁 Final: Return complete analysis
      if (!nextThoughtNeeded || thoughtNumber >= totalThoughts) {
        return JSON.stringify({
          step: "complete",
          message: "Analysis complete",
          fishbone: fishbone,
          confidence: args.confidence || 0.95,
          generatedAt: new Date().toISOString(),
          nextThoughtNeeded: false,
          summary: "Analysis complete with structured fishbone diagram data"
        });
      }

      // Default: Progress pass-through
      return JSON.stringify({
        step: "progress",
        message: thought || `ขั้นตอนที่ ${thoughtNumber}/${totalThoughts}`,
        currentStep: thoughtNumber,
        totalSteps: totalThoughts,
        nextThoughtNeeded: thoughtNumber < totalThoughts,
        fishbone: fishbone
      });
    }
  });