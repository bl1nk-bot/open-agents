"use client";

import { Target } from "lucide-react";
import type { ToolRendererProps } from "../../../app/lib/render-tool";
import { ToolLayout } from "../tool-layout";

// Temporary simple renderer - will integrate with @json-render/react later
export function FishboneRenderer({
  part,
  state,
  onApprove,
  onDeny,
}: ToolRendererProps<"tool-fishbone">) {
  const output = part.state === "output-available" ? part.output : undefined;

  let spec = null;
  let nextThoughtNeeded = false;
  let guidance = "";

  if (output && typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      spec = parsed.spec;
      nextThoughtNeeded = parsed.nextThoughtNeeded;
      guidance = parsed.guidance;
    } catch (e) {
      // Handle parse error
    }
  }

  const summary = spec?.state?.fishbone?.problem
    ? `Analyzing: ${spec.state.fishbone.problem}`
    : "Fishbone Analysis";

  const meta = nextThoughtNeeded ? "In Progress" : "Complete";

  return (
    <ToolLayout
      name="Fishbone"
      icon={<Target className="h-3.5 w-3.5" />}
      summary={summary}
      meta={meta}
      state={state}
      onApprove={onApprove}
      onDeny={onDeny}
    >
      {spec && (
        <div className="mt-2 p-4 border rounded-lg bg-muted/50">
          <div className="text-sm font-medium mb-2">Analysis Progress</div>
          <div className="text-xs text-muted-foreground mb-4">
            Step {spec.state?.currentStep || 1} of {spec.state?.totalSteps || 8}
          </div>

          {spec.elements && Object.entries(spec.elements).map(([id, element]: [string, any]) => {
            if (id.startsWith('root') || id.startsWith('progress')) return null;

            return (
              <div key={id} className="mb-3 p-3 bg-background rounded border">
                <div className="font-medium text-sm">{element.props?.stepNumber ? `Step ${element.props.stepNumber}` : element.type}</div>
                <div className="text-sm mt-1">{element.props?.content || element.props?.problem}</div>
                {element.props?.category && (
                  <div className="text-xs text-muted-foreground mt-1">Category: {element.props.category}</div>
                )}
              </div>
            );
          })}

          {guidance && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">Guidance</div>
              <div className="text-sm text-blue-800 dark:text-blue-200 mt-1">{guidance}</div>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
}