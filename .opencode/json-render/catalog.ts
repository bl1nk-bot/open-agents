import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const fishboneCatalog = defineCatalog(schema, {
  components: {
    // Canvas & Layout
    FishboneCanvas: {
      props: z.object({
        problem: z.string(),
        stepType: z.string(),
        confidence: z.number().min(0).max(1).optional()
      }),
      description: "Main canvas for Fishbone analysis UI"
    },
    StepProgress: {
      props: z.object({
        current: z.number(),
        total: z.number(),
        categories: z.array(z.string()),
        completed: z.array(z.string())
      }),
      description: "Progress bar showing analysis steps and category completion"
    },
    // Step Components
    FishboneStep: {
      props: z.object({
        stepNumber: z.number(),
        content: z.string(),
        category: z.string().optional(),
        isRevision: z.boolean().optional(),
        branchId: z.string().optional()
      }),
      description: "Displays current thinking step with optional category/branch context"
    },
    CategorySelector: {
      props: z.object({
        available: z.array(z.string()),
        selected: z.array(z.string())
      }),
      description: "Interactive selector for Fishbone categories"
    },
    CategoryList: {
      props: z.object({
        categories: z.array(z.object({
          id: z.string(),
          name: z.string(),
          description: z.string()
        }))
      }),
      description: "List of categories with descriptions"
    },
    // Cause Building Components
    CauseForm: {
      props: z.object({
        level: z.enum(["main", "sub"]),
        category: z.string(),
        placeholder: z.string()
      }),
      description: "Form input for adding new causes"
    },
    FiveWhysForm: {
      props: z.object({
        subCauseId: z.string(),
        questions: z.array(z.string())
      }),
      description: "Guided 5 Whys questioning interface"
    },
    CauseTree: {
      props: z.object({
        category: z.string(),
        causes: z.array(z.any()) // Hierarchical cause data
      }),
      description: "Tree view of causes for a category"
    },
    // Actions & Report
    ActionButtons: {
      props: z.object({
        actions: z.array(z.object({
          id: z.string(),
          label: z.string(),
          action: z.string(),
          params: z.record(z.any())
        }))
      }),
      description: "Buttons that trigger state updates or actions"
    },
    FishboneReport: {
      props: z.object({
        problem: z.string(),
        hierarchy: z.any(),
        completedCategories: z.array(z.string()),
        generatedAt: z.string()
      }),
      description: "Final report view with complete Fishbone diagram data"
    }
  },
  actions: {
    updateState: {
      description: "Update fishbone state path with new value",
      params: z.object({
        path: z.string(),
        value: z.any(),
        operation: z.enum(["set", "push", "merge"]).optional()
      })
    },
    branch: {
      description: "Create new analysis branch from current state",
      params: z.object({
        fromThought: z.number(),
        branchName: z.string().optional()
      })
    },
    complete: {
      description: "Mark analysis as complete and generate final report",
      params: z.object({})
    },
    export: {
      description: "Export report in specified format",
      params: z.object({
        format: z.enum(["markdown", "json", "pdf", "png"])
      })
    }
  }
});