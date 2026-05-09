import { tool } from "ai";
import { z } from "zod";

// ========== JSON-Render Spec Types ==========
type JsonRenderElement = {
  type: string;
  props: Record<string, any>;
  children: string[];
  visible?: any[];
  watch?: Record<string, any>;
};

type JsonRenderSpec = {
  root: string;
  elements: Record<string, JsonRenderElement>;
  state?: Record<string, any>;
  actions?: Record<string, any>;
};

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
    description: "Step-by-step root cause analysis using Fishbone Diagram. Returns json-render spec for real-time UI rendering. Call repeatedly with updated state until nextThoughtNeeded=false.",

    inputSchema: fishboneArgs,

    execute: async (args, context) => {
      const {
        thoughtNumber,
        totalThoughts,
        fishbone = {},
        nextThoughtNeeded,
        thought
      } = args;

      // Helper: Generate unique ID for elements
      const id = (prefix: string) => `${prefix}-${thoughtNumber}-${Date.now().toString(36).slice(-4)}`;

      // Helper: Build json-render spec from current state
      const buildSpec = (stepContent: string, stepType: string, extraElements: Record<string, JsonRenderElement> = {}): JsonRenderSpec => {
        const rootId = id("root");
        const stepId = id("step");
        const progressId = id("progress");

        return {
          root: rootId,
          state: {
            currentStep: thoughtNumber,
            totalSteps: totalThoughts,
            confidence: args.confidence || 0,
            fishbone: fishbone
          },
          elements: {
            [rootId]: {
              type: "FishboneCanvas",
              props: {
                problem: fishbone.problem || "Untitled Analysis",
                stepType,
                confidence: args.confidence || 0
              },
              children: [progressId, stepId, ...Object.keys(extraElements)]
            },
            [progressId]: {
              type: "StepProgress",
              props: {
                current: thoughtNumber,
                total: totalThoughts,
                categories: fishbone.categories || [],
                completed: fishbone.completedCategories || []
              },
              children: []
            },
            [stepId]: {
              type: "FishboneStep",
              props: {
                stepNumber: thoughtNumber,
                content: stepContent,
                category: fishbone.currentCategory,
                isRevision: args.isRevision,
                branchId: args.branchId
              },
              children: []
            },
            ...extraElements
          },
          actions: {
            updateState: { description: "Update fishbone state for next step" },
            branch: { description: "Create new analysis branch" },
            complete: { description: "Mark analysis complete" }
          }
        };
      };

      // 🎯 Step 1: Initialize
      if (thoughtNumber === 1 && !fishbone.problem) {
        return JSON.stringify({
          spec: buildSpec(
            "โครงสร้าง Fishbone พร้อมใช้งาน กำหนด fishbone.problem และ fishbone.categories เพื่อเริ่มวิเคราะห์",
            "init",
            {
              [id("hint")]: {
                type: "CategorySelector",
                props: {
                  available: ["People", "Process", "Technology", "Environment", "Material", "Measurement"],
                  selected: []
                },
                children: [],
                watch: {
                  "/state/fishbone/categories": {
                    action: "updateState",
                    params: { path: "/fishbone/categories", value: { "$event": "value" } }
                  }
                }
              }
            }
          ),
          nextThoughtNeeded: true,
          guidance: "Set fishbone.problem + fishbone.categories in next call"
        });
      }

      // 🗂️ Step 2: Category Selection
      if (thoughtNumber === 2 && !fishbone.currentCategory) {
        const available = (fishbone.categories || [])
          .filter((c: string) => !fishbone.completedCategories?.includes(c));

        return JSON.stringify({
          spec: buildSpec(
            `เลือกหมวดหมู่เพื่อวิเคราะห์: ${available.join(", ")}`,
            "category-select",
            {
              [id("cat-list")]: {
                type: "CategoryList",
                props: {
                  categories: available.map((cat: string) => ({
                    id: cat.toLowerCase(),
                    name: cat,
                    description: `${cat} causes related to "${fishbone.problem}"`
                  }))
                },
                children: [],
                watch: {
                  "/state/selectedCategory": {
                    action: "updateState",
                    params: {
                      path: "/fishbone/currentCategory",
                      value: { "$event": "value" }
                    }
                  }
                }
              }
            }
          ),
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
            spec: buildSpec(
              `หมวดหมู่: ${fishbone.currentCategory}\nเพิ่มสาเหตุหลัก: { name: "string", subCauses: [] }`,
              "add-main-cause",
              {
                [id("main-cause-form")]: {
                  type: "CauseForm",
                  props: {
                    level: "main",
                    category: fishbone.currentCategory,
                    placeholder: "Enter main cause name..."
                  },
                  children: [],
                  watch: {
                    "/state/newMainCause": {
                      action: "updateState",
                      params: {
                        path: "/fishbone/hierarchy/mainCauses",
                        operation: "push",
                        value: {
                          id: { "$uuid": true },
                          name: { "$event": "value" },
                          category: fishbone.currentCategory,
                          subCauses: []
                        }
                      }
                    }
                  }
                }
              }
            ),
            nextThoughtNeeded: true,
            guidance: "Add main cause to fishbone.hierarchy.mainCauses array"
          });
        }

        // Prompt for sub-cause
        const incompleteSub = currentMain.subCauses?.find((s: any) => !s.rootCause);
        if (incompleteSub) {
          return JSON.stringify({
            spec: buildSpec(
              `สาเหตุย่อย: ${incompleteSub.name}\nใช้ 5 Whys เพื่อหาสาเหตุรากฐาน`,
              "five-whys",
              {
                [id("whys-form")]: {
                  type: "FiveWhysForm",
                  props: {
                    subCauseId: incompleteSub.id,
                    questions: [
                      "Why did this happen?",
                      "Why did that occur?",
                      "Why was that the case?",
                      "Why didn't prevention work?",
                      "Why is this the root?"
                    ]
                  },
                  children: [],
                  watch: {
                    "/state/fiveWhysComplete": {
                      action: "updateState",
                      params: {
                        path: `/fishbone/hierarchy/mainCauses/*/subCauses/[id="${incompleteSub.id}"]`,
                        updates: {
                          fiveWhys: { "$event": "answers" },
                          rootCause: { "$event": "rootAnswer" }
                        }
                      }
                    }
                  }
                }
              }
            ),
            nextThoughtNeeded: true,
            guidance: "Set fiveWhys: [string] + rootCause: string for this sub-cause"
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

          // Build hierarchy preview elements
          const hierarchyElements: Record<string, JsonRenderElement> = {};
          const causeListId = id("cause-list");
          hierarchyElements[causeListId] = {
            type: "CauseTree",
            props: {
              category: fishbone.currentCategory,
              causes: hierarchy.mainCauses?.filter((m: any) => m.category === fishbone.currentCategory) || []
            },
            children: []
          };

          return JSON.stringify({
            spec: buildSpec(
              nextCat
                ? `✅ "${fishbone.currentCategory}" เสร็จสิ้น → ต่อไป: "${nextCat}"`
                : `✅ ทั้งหมดเสร็จสิ้น พร้อมสรุปผล`,
              "category-complete",
              {
                ...hierarchyElements,
                [id("next-action")]: {
                  type: "ActionButtons",
                  props: {
                    actions: nextCat ? [
                      { id: "next-cat", label: `วิเคราะห์ "${nextCat}"`, action: "updateState", params: { path: "/fishbone/currentCategory", value: nextCat } }
                    ] : [
                      { id: "complete", label: "สร้างรายงาน", action: "complete", params: {} }
                    ]
                  },
                  children: []
                }
              }
            ),
            nextThoughtNeeded: !!nextCat,
            fishbone: {
              ...fishbone,
              completedCategories: [...(fishbone.completedCategories || []), fishbone.currentCategory],
              currentCategory: nextCat || undefined
            }
          });
        }
      }

      // 🏁 Final: Return complete spec
      if (!nextThoughtNeeded || thoughtNumber >= totalThoughts) {
        return JSON.stringify({
          spec: {
            root: id("final"),
            state: { complete: true, fishbone, confidence: args.confidence || 0.95 },
            elements: {
              [id("final")]: {
                type: "FishboneReport",
                props: {
                  problem: fishbone.problem,
                  hierarchy: fishbone.hierarchy,
                  completedCategories: fishbone.completedCategories,
                  generatedAt: new Date().toISOString()
                },
                children: []
              }
            },
            actions: {
              export: { description: "Export report as Markdown/PDF" },
              share: { description: "Share analysis link" }
            }
          },
          nextThoughtNeeded: false,
          summary: "Analysis complete. Use spec to render final report."
        });
      }

      // Default: Progress pass-through
      return JSON.stringify({
        spec: buildSpec(thought || `ขั้นตอนที่ ${thoughtNumber}/${totalThoughts}`, "progress"),
        nextThoughtNeeded: thoughtNumber < totalThoughts,
        state: {
          category: fishbone.currentCategory,
          progress: fishbone.completedCategories?.length || 0
        }
      });
    }
  });