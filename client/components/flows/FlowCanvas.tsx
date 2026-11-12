import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FlowEdge, FlowStep } from "@shared/api";
import { stepBranches, stepSummary } from "@/components/flows/flowModel";
import "./flow.css";

type StepData = { step: FlowStep; selected: boolean };
type StepNode = Node<StepData, "step">;

const StepCard = memo(function StepCard({ data }: NodeProps<StepNode>) {
  const { t } = useTranslation();
  const branches = stepBranches(data.step.stepType);
  return (
    <div className={data.selected ? "mp-flow-node is-selected" : "mp-flow-node"}>
      {data.step.stepType !== "trigger" ? <Handle type="target" position={Position.Top} /> : null}
      <p className="text-xs font-medium text-primary">{t(`flows.type.${data.step.stepType}`)}</p>
      <strong>{data.step.label}</strong>
      <span>{stepSummary(data.step)}</span>
      {branches.map((branch, index) => (
        <Handle key={branch} id={branch} type="source" position={Position.Bottom} style={{ left: branches.length === 1 ? "50%" : `${30 + index * 40}%` }} />
      ))}
    </div>
  );
});

const nodeTypes = { step: StepCard };

export default function FlowCanvas({
  steps,
  edges,
  selectedKey,
  readOnly,
  onSelect,
  onChange,
}: {
  steps: FlowStep[];
  edges: FlowEdge[];
  selectedKey: string | null;
  readOnly: boolean;
  onSelect: (key: string | null) => void;
  onChange: (next: { steps: FlowStep[]; edges: FlowEdge[] }) => void;
}) {
  const { t } = useTranslation();
  const nodes: StepNode[] = useMemo(
    () => steps.map((step) => ({
      id: step.stepKey,
      type: "step",
      position: { x: step.x, y: step.y },
      data: { step, selected: step.stepKey === selectedKey },
      draggable: !readOnly,
    })),
    [steps, selectedKey, readOnly],
  );
  const rfEdges: Edge[] = useMemo(
    () => edges.map((edge) => ({
      id: `${edge.sourceKey}-${edge.edgeType}-${edge.targetKey}`,
      source: edge.sourceKey,
      target: edge.targetKey,
      sourceHandle: edge.edgeType,
      label: edge.edgeType === "next" ? undefined : t(`flows.branch.${edge.edgeType}`),
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
    [edges, t],
  );

  return (
    <div className="mp-flow">
      <ReactFlow
        nodes={nodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        onNodeDragStop={(_, node) => {
          onChange({
            edges,
            steps: steps.map((step) => (step.stepKey === node.id ? { ...step, x: node.position.x, y: node.position.y } : step)),
          });
        }}
        onConnect={(connection) => {
          if (readOnly || !connection.source || !connection.target) return;
          const edgeType = (connection.sourceHandle || "next") as FlowEdge["edgeType"];
          const source = steps.find((step) => step.stepKey === connection.source);
          if (!source || !stepBranches(source.stepType).includes(edgeType)) return;
          const next = edges.filter((edge) => !(edge.sourceKey === connection.source && edge.edgeType === edgeType));
          next.push({ sourceKey: connection.source, targetKey: connection.target, edgeType });
          onChange({ steps, edges: next });
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
