import {
  Circle,
  Eye,
  EyeOff,
  MousePointer2,
  PencilLine,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  Square,
  Star,
  Trash2,
  Triangle
} from "lucide-react";

import type {
  DrawingKind,
  MeasureKind,
  MeasureSnapMode
} from "@shared/types";

interface BoardToolbarProps {
  tool: "select" | "draw" | "measure";
  onToolChange: (tool: "select" | "draw" | "measure") => void;
  viewZoom: number;
  isDungeonMaster: boolean;
  fogEnabled: boolean;
  fogPlayers: Array<{ userId: string; name: string }>;
  dmFogEnabled: boolean;
  dmFogUserId: string | null;
  onSetDmFogEnabled: (value: boolean) => void;
  onSetDmFogUserId: (value: string | null) => void;
  onResetFog: () => void;
  onClearFog: () => void;
  measureKind: MeasureKind;
  onMeasureKindChange: (kind: MeasureKind) => void;
  measureSnapMode: MeasureSnapMode;
  onMeasureSnapModeChange: (mode: MeasureSnapMode) => void;
  coneAngle: 45 | 60 | 90;
  onConeAngleChange: (value: 45 | 60 | 90) => void;
  beamWidthSquares: number;
  onBeamWidthSquaresChange: (value: number) => void;
  measureBroadcast: boolean;
  onMeasureBroadcastChange: (value: boolean) => void;
  drawKind: DrawingKind;
  onDrawKindChange: (kind: DrawingKind) => void;
  strokeColor: string;
  onStrokeColorChange: (value: string) => void;
  strokeOpacity: number;
  onStrokeOpacityChange: (value: number) => void;
  fillColor: string;
  onFillColorChange: (value: string) => void;
  fillOpacity: number;
  onFillOpacityChange: (value: number) => void;
  strokeSize: number;
  onStrokeSizeChange: (value: number) => void;
  onClearInk: () => void;
}

export function BoardToolbar({
  tool,
  onToolChange,
  viewZoom,
  isDungeonMaster,
  fogEnabled,
  fogPlayers,
  dmFogEnabled,
  dmFogUserId,
  onSetDmFogEnabled,
  onSetDmFogUserId,
  onResetFog,
  onClearFog,
  measureKind,
  onMeasureKindChange,
  measureSnapMode,
  onMeasureSnapModeChange,
  coneAngle,
  onConeAngleChange,
  beamWidthSquares,
  onBeamWidthSquaresChange,
  measureBroadcast,
  onMeasureBroadcastChange,
  drawKind,
  onDrawKindChange,
  strokeColor,
  onStrokeColorChange,
  strokeOpacity,
  onStrokeOpacityChange,
  fillColor,
  onFillColorChange,
  fillOpacity,
  onFillOpacityChange,
  strokeSize,
  onStrokeSizeChange,
  onClearInk
}: BoardToolbarProps) {
  return (
    <>
      <div className="board-toolbar">
        <div className="segmented">
          <button
            className={tool === "select" ? "is-active" : ""}
            type="button"
            title="Select"
            aria-label="Select"
            onClick={() => onToolChange("select")}
          >
            <MousePointer2 size={15} />
          </button>
          <button
            className={tool === "draw" ? "is-active" : ""}
            type="button"
            title="Draw"
            aria-label="Draw"
            onClick={() => onToolChange("draw")}
          >
            <PencilLine size={15} />
          </button>
          <button
            className={tool === "measure" ? "is-active" : ""}
            type="button"
            title="Measure"
            aria-label="Measure"
            onClick={() => onToolChange("measure")}
          >
            <Ruler size={15} />
          </button>
        </div>
        <div className="tool-meta">
          <span className="board-zoom-chip">Zoom {Math.round(viewZoom * 100)}%</span>
          {isDungeonMaster && fogEnabled && (
            <>
              {fogPlayers.length > 0 && (
                <>
                  <select value={dmFogUserId ?? ""} onChange={(event) => onSetDmFogUserId(event.target.value || null)}>
                    {fogPlayers.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`icon-action-button ${dmFogEnabled ? "is-active" : ""}`}
                    title={dmFogEnabled ? "Hide player fog" : "View player fog"}
                    disabled={!dmFogUserId}
                    onClick={() => onSetDmFogEnabled(!dmFogEnabled)}
                  >
                    {dmFogEnabled ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    className="icon-action-button"
                    title="Reset remembered fog"
                    onClick={onResetFog}
                  >
                    <RotateCcw size={15} />
                  </button>
                </>
              )}
              <button
                type="button"
                className="board-toolbar-action danger-button"
                title="Clear fog for all users"
                onClick={onClearFog}
              >
                Clear Fog
              </button>
            </>
          )}
        </div>
      </div>
      {tool === "measure" && (
        <div className="board-measure-controls">
          <div className="segmented board-measure-kind-picker">
            <button
              type="button"
              className={measureKind === "line" ? "is-active" : ""}
              title="Line"
              aria-label="Line"
              onClick={() => onMeasureKindChange("line")}
            >
              <Ruler size={14} />
            </button>
            <button
              type="button"
              className={measureKind === "cone" ? "is-active" : ""}
              title="Cone"
              aria-label="Cone"
              onClick={() => onMeasureKindChange("cone")}
            >
              <Triangle size={14} />
            </button>
            <button
              type="button"
              className={measureKind === "beam" ? "is-active" : ""}
              title="Beam"
              aria-label="Beam"
              onClick={() => onMeasureKindChange("beam")}
            >
              <RectangleHorizontal size={14} />
            </button>
            <button
              type="button"
              className={measureKind === "emanation" ? "is-active" : ""}
              title="Emanation"
              aria-label="Emanation"
              onClick={() => onMeasureKindChange("emanation")}
            >
              <Circle size={14} />
            </button>
            <button
              type="button"
              className={measureKind === "square" ? "is-active" : ""}
              title="Square"
              aria-label="Square"
              onClick={() => onMeasureKindChange("square")}
            >
              <Square size={14} />
            </button>
          </div>
          <label>
            Snap
            <select value={measureSnapMode} onChange={(event) => onMeasureSnapModeChange(event.target.value as MeasureSnapMode)}>
              <option value="center">Center</option>
              <option value="corner">Corner</option>
              <option value="none">Free</option>
            </select>
          </label>
          {measureKind === "cone" && (
            <label>
              Angle
              <select
                value={coneAngle}
                onChange={(event) => onConeAngleChange(Number(event.target.value) as 45 | 60 | 90)}
              >
                <option value="45">45°</option>
                <option value="60">60°</option>
                <option value="90">90°</option>
              </select>
            </label>
          )}
          {measureKind === "beam" && (
            <label>
              Width
              <input
                type="range"
                min="1"
                max="8"
                value={beamWidthSquares}
                onChange={(event) => onBeamWidthSquaresChange(Number(event.target.value))}
              />
              <span>{beamWidthSquares} sq</span>
            </label>
          )}
          <label className="board-inline-toggle">
            <input
              type="checkbox"
              checked={measureBroadcast}
              onChange={(event) => onMeasureBroadcastChange(event.target.checked)}
            />
            Broadcast
          </label>
        </div>
      )}
      {tool === "draw" && (
        <div className="board-draw-controls">
          <div className="segmented board-shape-picker">
            <button
              type="button"
              className={drawKind === "freehand" ? "is-active" : ""}
              title="Freehand"
              onClick={() => onDrawKindChange("freehand")}
            >
              <PencilLine size={14} />
            </button>
            <button
              type="button"
              className={drawKind === "circle" ? "is-active" : ""}
              title="Circle"
              onClick={() => onDrawKindChange("circle")}
            >
              <Circle size={14} />
            </button>
            <button
              type="button"
              className={drawKind === "square" ? "is-active" : ""}
              title="Square"
              onClick={() => onDrawKindChange("square")}
            >
              <Square size={14} />
            </button>
            <button
              type="button"
              className={drawKind === "star" ? "is-active" : ""}
              title="Star"
              onClick={() => onDrawKindChange("star")}
            >
              <Star size={14} />
            </button>
          </div>
          <label>
            Stroke
            <input type="color" value={strokeColor} onChange={(event) => onStrokeColorChange(event.target.value)} />
          </label>
          <label>
            Stroke {Math.round(strokeOpacity * 100)}%
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(strokeOpacity * 100)}
              onChange={(event) => onStrokeOpacityChange(Number(event.target.value) / 100)}
            />
          </label>
          <label>
            Fill
            <input type="color" value={fillColor} onChange={(event) => onFillColorChange(event.target.value)} />
          </label>
          <label>
            Fill {Math.round(fillOpacity * 100)}%
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(fillOpacity * 100)}
              onChange={(event) => onFillOpacityChange(Number(event.target.value) / 100)}
            />
          </label>
          <label>
            Size
            <input
              type="range"
              min="1"
              max="16"
              value={strokeSize}
              onChange={(event) => onStrokeSizeChange(Number(event.target.value))}
            />
          </label>
          {isDungeonMaster && (
            <button type="button" className="icon-action-button" title="Clear ink" onClick={onClearInk}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
