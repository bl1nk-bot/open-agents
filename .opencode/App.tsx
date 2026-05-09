import { Renderer } from "@json-render/react";
import { registry } from "./json-render/registry";
import { useState, useCallback } from "react";

export default function FishboneApp() {
  const [spec, setSpec] = useState<any>(null);
  const [state, setState] = useState<any>({
    thought: "เริ่มวิเคราะห์...",
    thoughtNumber: 1,
    totalThoughts: 8,
    nextThoughtNeeded: true,
    fishbone: {
      problem: "",
      categories: [],
      hierarchy: { mainCauses: [] }
    }
  });

  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = useCallback(async () => {
    // This would call the fishbone tool with current state
    // For demo purposes, we'll simulate the response
    const mockResponse = {
      spec: {
        root: "root-1",
        state: {
          currentStep: currentStep + 1,
          totalSteps: 8,
          confidence: 0.5,
          fishbone: state.fishbone
        },
        elements: {
          "root-1": {
            type: "FishboneCanvas",
            props: {
              problem: state.fishbone.problem || "Sample Problem",
              stepType: "progress",
              confidence: 0.5
            },
            children: ["progress-1", "step-1"]
          },
          "progress-1": {
            type: "StepProgress",
            props: {
              current: currentStep + 1,
              total: 8,
              categories: ["People", "Process"],
              completed: []
            },
            children: []
          },
          "step-1": {
            type: "FishboneStep",
            props: {
              stepNumber: currentStep + 1,
              content: `Step ${currentStep + 1} content`,
              category: state.fishbone.currentCategory
            },
            children: []
          }
        }
      }
    };

    setSpec(mockResponse.spec);
    setCurrentStep(currentStep + 1);
  }, [currentStep, state]);

  return (
    <div className="fishbone-app">
      <h1>Fishbone Analysis Tool</h1>
      <button onClick={handleNext}>Next Step</button>

      {spec && (
        <Renderer
          spec={spec}
          registry={registry}
          onAction={(action, params) => {
            console.log("Action:", action, params);
            // Handle actions here
          }}
        />
      )}
    </div>
  );
}