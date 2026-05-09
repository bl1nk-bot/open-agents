import { defineRegistry } from "@json-render/react";
import { fishboneCatalog } from "./catalog";

// Placeholder components - these would need to be implemented
const FishboneCanvas = ({ props, children }: any) => (
  <div className="fishbone-canvas">
    <h1>{props.problem}</h1>
    <div>Step Type: {props.stepType}</div>
    {children}
  </div>
);

const StepProgress = ({ props }: any) => (
  <div className="step-progress">
    Step {props.current} of {props.total}
  </div>
);

const FishboneStep = ({ props }: any) => (
  <div className="fishbone-step">
    <h3>Step {props.stepNumber}</h3>
    <p>{props.content}</p>
    {props.category && <span>Category: {props.category}</span>}
  </div>
);

const CategorySelector = ({ props, emit }: any) => (
  <div className="category-selector">
    <h4>Select Categories:</h4>
    {props.available.map((cat: string) => (
      <button key={cat} onClick={() => emit("updateState", { path: "/fishbone/categories", value: cat })}>
        {cat}
      </button>
    ))}
  </div>
);

const CategoryList = ({ props, emit }: any) => (
  <div className="category-list">
    {props.categories.map((cat: any) => (
      <div key={cat.id}>
        <h5>{cat.name}</h5>
        <p>{cat.description}</p>
        <button onClick={() => emit("updateState", { path: "/fishbone/currentCategory", value: cat.name })}>
          Select
        </button>
      </div>
    ))}
  </div>
);

const CauseForm = ({ props, emit }: any) => (
  <div className="cause-form">
    <input placeholder={props.placeholder} onChange={(e) => emit("updateState", {
      path: "/fishbone/hierarchy/mainCauses",
      operation: "push",
      value: { id: crypto.randomUUID(), name: e.target.value, category: props.category, subCauses: [] }
    })} />
  </div>
);

const FiveWhysForm = ({ props, emit }: any) => (
  <div className="five-whys-form">
    {props.questions.map((q: string, i: number) => (
      <div key={i}>
        <p>{q}</p>
        <input onChange={(e) => {
          // Simplified - would need proper state management
        }} />
      </div>
    ))}
  </div>
);

const CauseTree = ({ props }: any) => (
  <div className="cause-tree">
    <h4>{props.category} Causes</h4>
    {props.causes.map((cause: any) => (
      <div key={cause.id}>
        <strong>{cause.name}</strong>
        {cause.subCauses?.map((sub: any) => (
          <div key={sub.id} style={{ marginLeft: '20px' }}>
            - {sub.name}
          </div>
        ))}
      </div>
    ))}
  </div>
);

const ActionButtons = ({ props, emit }: any) => (
  <div className="action-buttons">
    {props.actions.map((action: any) => (
      <button key={action.id} onClick={() => emit(action.action, action.params)}>
        {action.label}
      </button>
    ))}
  </div>
);

const FishboneReport = ({ props }: any) => (
  <div className="fishbone-report">
    <h2>Report for: {props.problem}</h2>
    <p>Generated: {props.generatedAt}</p>
    <h3>Completed Categories: {props.completedCategories?.join(", ")}</h3>
    <pre>{JSON.stringify(props.hierarchy, null, 2)}</pre>
  </div>
);

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
});