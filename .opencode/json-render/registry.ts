import { defineRegistry } from "@json-render/react"
import { fishboneCatalog } from "./catalog"
import { FishboneCanvas, StepProgress, FishboneStep } from "./components"
import { CategorySelector, CategoryList, CauseForm, FiveWhysForm, CauseTree } from "./components"
import { ActionButtons, FishboneReport } from "./components"

export const { registry } = defineRegistry(fishboneCatalog, {
  components: {
    FishboneCanvas: ({ props, children, emit }) => (
      <FishboneCanvas 
        problem={props.problem}
        stepType={props.stepType}
        confidence={props.confidence}
        onUpdate={(newState) => emit("updateState", { value: newState })}
      >
        {children}
      </FishboneCanvas>
    ),
    StepProgress: ({ props }) => (
      <StepProgress 
        current={props.current}
        total={props.total}
        categories={props.categories}
        completed={props.completed}
      />
    ),
    FishboneStep: ({ props }) => (
      <FishboneStep
        stepNumber={props.stepNumber}
        content={props.content}
        category={props.category}
        isRevision={props.isRevision}
        branchId={props.branchId}
      />
    ),
    CategorySelector: ({ props, emit }) => (
      <CategorySelector
        available={props.available}
        selected={props.selected}
        onSelect={(cat) => emit("updateState", { path: "/fishbone/categories", value: cat })}
      />
    ),
    CategoryList: ({ props, emit }) => (
      <CategoryList
        categories={props.categories}
        onSelect={(cat) => emit("updateState", { path: "/fishbone/currentCategory", value: cat })}
      />
    ),
    CauseForm: ({ props, emit }) => (
      <CauseForm
        level={props.level}
        category={props.category}
        placeholder={props.placeholder}
        onSubmit={(name) => emit("updateState", { 
          path: "/fishbone/hierarchy/mainCauses", 
          operation: "push",
          value: { id: crypto.randomUUID(), name, category: props.category, subCauses: [] }
        })}
      />
    ),
    FiveWhysForm: ({ props, emit }) => (
      <FiveWhysForm
        questions={props.questions}
        onComplete={(answers, root) => emit("updateState", {
          path: `/fishbone/hierarchy/mainCauses/*/subCauses/[id="${props.subCauseId}"]`,
          updates: { fiveWhys: answers, rootCause: root }
        })}
      />
    ),
    CauseTree: ({ props }) => (
      <CauseTree category={props.category} causes={props.causes} />
    ),
    ActionButtons: ({ props, emit }) => (
      <ActionButtons
        actions={props.actions}
        onAction={(action) => emit(action.action, action.params)}
      />
    ),
    FishboneReport: ({ props }) => (
      <FishboneReport
        problem={props.problem}
        hierarchy={props.hierarchy}
        completedCategories={props.completedCategories}
        generatedAt={props.generatedAt}
      />
    )
  }
})