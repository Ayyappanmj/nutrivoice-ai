import React, { useState } from 'react'
import { Terminal, ChevronDown, ChevronUp, Copy, Check, Cpu, Zap, Activity } from 'lucide-react'

export function BedrockMcpMonitor({ logs = [] }) {
  const [isOpen, setIsOpen] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [selectedLogId, setSelectedLogId] = useState(null)

  const handleCopy = (log) => {
    const jsonStr = JSON.stringify(log.payload, null, 2)
    navigator.clipboard.writeText(jsonStr)
    setCopiedId(log.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const sampleLogsFallback = [
    {
      id: "log_init_1",
      timestamp: "13:15:02.412",
      tool: "log_food_entry",
      direction: "OUTGOING",
      status: "success",
      latency_ms: 412.5,
      payload: {
        tool: "log_food_entry",
        arguments: {
          meal_type: "lunch",
          items: [
            { name: "Grilled Salmon", calories: 340, protein_g: 38, carbs_g: 0, fat_g: 18 },
            { name: "Quinoa", calories: 222, protein_g: 8, carbs_g: 39, fat_g: 3.5 },
            { name: "Avocado", calories: 160, protein_g: 2, carbs_g: 8, fat_g: 4.5 }
          ]
        },
        result: {
          status: "success",
          total_calories: 722,
          total_protein_g: 48,
          entry_id: 2
        }
      }
    },
    {
      id: "log_init_2",
      timestamp: "13:15:01.884",
      tool: "get_daily_summary",
      direction: "OUTGOING",
      status: "success",
      latency_ms: 194.2,
      payload: {
        tool: "get_daily_summary",
        arguments: { date: "2026-10-15" },
        result: {
          target_calories: 2200,
          consumed_calories: 1450,
          target_protein_g: 160,
          consumed_protein_g: 122,
          adherence_score: 66.0
        }
      }
    }
  ]

  const displayLogs = logs.length > 0 ? logs : sampleLogsFallback
  const activeLog = displayLogs.find(l => l.id === selectedLogId) || displayLogs[0]

  return (
    <div className="rounded-3xl glass-card overflow-hidden border border-white/10">
      {/* Collapsible Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer p-4 md:p-5 bg-slate-900/80 hover:bg-slate-900 transition flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Bedrock MCP Tool Monitor
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                JSON-RPC v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live inspection of raw tool execution payloads, latency telemetry, and Bedrock schema calls.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              anthropic.claude-3-5-sonnet
            </span>
            <span>•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              Sub-second
            </span>
          </div>
          <button className="p-1 rounded-lg text-slate-400 hover:text-white">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Panel */}
      {isOpen && (
        <div className="p-5 border-t border-white/10 bg-[#060911]/90 space-y-4">
          
          {/* Recent tool calls selector */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400 font-medium">Recent Calls:</span>
            {displayLogs.map((log) => {
              const isSelected = (activeLog && activeLog.id === log.id)
              return (
                <button
                  key={log.id}
                  onClick={() => setSelectedLogId(log.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all flex items-center space-x-2 ${
                    isSelected
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 font-semibold shadow-sm'
                      : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="font-bold">{log.tool}</span>
                  <span className="text-[10px] opacity-75">({log.latency_ms}ms)</span>
                </button>
              )
            })}
          </div>

          {/* Active Log Viewer */}
          {activeLog && (
            <div className="rounded-2xl bg-black/60 border border-white/5 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-2">
                <div className="flex items-center space-x-3">
                  <span className="text-emerald-400 font-semibold">{activeLog.direction}</span>
                  <span>Tool: <strong className="text-white">{activeLog.tool}</strong></span>
                  <span>Timestamp: {activeLog.timestamp}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
                    Latency: {activeLog.latency_ms}ms
                  </span>
                  <button
                    onClick={() => handleCopy(activeLog)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1"
                    title="Copy JSON Payload"
                  >
                    {copiedId === activeLog.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="text-[10px]">Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Pretty JSON Block */}
              <div className="overflow-x-auto max-h-60 p-2 text-slate-300 leading-relaxed">
                <pre>{JSON.stringify(activeLog.payload, null, 2)}</pre>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
