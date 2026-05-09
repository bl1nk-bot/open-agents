import { Renderer } from "@json-render/react"
import { registry } from "./json-render/registry"
import { useState, useCallback } from "react"
export default function FishboneApp() {
  const [spec, setSpec] = useState<any>(null)
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
  })