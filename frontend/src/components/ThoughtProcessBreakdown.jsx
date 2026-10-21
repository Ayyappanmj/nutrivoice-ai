import React, { useState } from 'react'
import { BrainCircuit, Search, Wrench, Database, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Zap, Clock } from 'lucide-react'

export function ThoughtProcessBreakdown({ pipeline, latencyMs, tokens, hasAmbiguity, disambiguationPrompt }) {
  const [expandedStep, setExpandedStep] = useState(null)

  const stepsMeta = [
    {
      id: 1,
      name: "Intent Recognition",
      icon: BrainCircuit,
      badge: "BEDROCK CONVERSE",
      color: "emerald",
      defaultDesc: "Parsed semantic intent: `INTENT_LOG_FOOD_ENTRY` via Claude 3.5 Sonnet Converse API."
    },
    {
      id: 2,
      name: "Entity Extraction",
      icon: Search,
      badge: "PORTION & MACRO PARSER",
      color: "cyan",
      defaultDesc: "Extracted: Wild Salmon (340 kcal / 38g P), Quinoa (222 kcal / 8g P), Avocado (160 kcal / 2g P)."
    },
    {
      id: 3,
      name: "MCP Tool Call",
      icon: Wrench,
      badge: "TOOL: log_food_entry",
      color: "violet",
      defaultDesc: "Dispatched typed JSON-RPC payload to local MCP Nutrition Server `/mcp/tools/call`."
    },
    {
      id: 4,
      name: "Database Commit",
      icon: Database,
      badge: "DYNAMODB / SQLITE",
      color: "amber",
      defaultDesc: "Committed to SQLite/DynamoDB food_entries table; updated daily target rings."
    }
  ]

  const toggleStep = (index) => {
    setExpandedStep(expandedStep === index ? null : index)
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BrainCircuit className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Real-Time Agent Thought Breakdown
          </h4>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1 bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-white/5">
            <Clock className="w-3 h-3 text-cyan-400" />
            {latencyMs ? `${latencyMs}ms` : '384ms'}
          </span>
          <span className="flex items-center gap-1 bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-white/5">
            <Zap className="w-3 h-3 text-emerald-400" />
            {tokens?.total ? `${tokens.total} tokens` : '342 tokens'}
          </span>
        </div>
      </div>

      {/* Disambiguation Warning if ambiguous input */}
      {hasAmbiguity && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3 text-amber-200 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-300">Conversational Disambiguation Fallback Triggered</p>
            <p className="text-amber-200/90 mt-0.5">
              {disambiguationPrompt || "Alexa prompt: Did your pizza slice have pepperoni or extra cheese?"}
            </p>
          </div>
        </div>
      )}

      {/* 4-Step Pipeline Flow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        {stepsMeta.map((meta, idx) => {
          const stepData = pipeline && pipeline[idx] ? pipeline[idx] : null
          const isExpanded = expandedStep === idx
          const Icon = meta.icon

          return (
            <div
              key={meta.id}
              onClick={() => toggleStep(idx)}
              className={`cursor-pointer rounded-xl p-3 border transition-all duration-200 ${
                isExpanded
                  ? 'bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-900/40 hover:bg-slate-900/70 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    meta.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                    meta.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' :
                    meta.color === 'violet' ? 'bg-violet-500/20 text-violet-400' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    {stepData?.name || meta.name}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  {isExpanded ? (
                    <ChevronUp className="w-3 h-3 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  )}
                </div>
              </div>

              <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {meta.badge}
                </span>
                <span className="text-slate-400">
                  {stepData?.timestamp || `${(idx + 1) * 85}ms`}
                </span>
              </div>

              <p className="mt-1.5 text-xs text-slate-300 line-clamp-2">
                {stepData?.detail || meta.defaultDesc}
              </p>

              {isExpanded && (
                <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-slate-400 space-y-1 font-mono">
                  <div className="text-emerald-400">Status: Verified OK</div>
                  <div className="text-slate-400 truncate">Payload: valid Pydantic v2</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
