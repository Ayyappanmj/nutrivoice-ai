import React from 'react'
import { Sparkles, Radio, Mic, Activity, RefreshCw, Cpu, CheckCircle2 } from 'lucide-react'

export function Header({ isSyncing, onRefresh, modelId = "anthropic.claude-3-5-sonnet", awsRegion = "us-east-1" }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#080c14]/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="relative group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all duration-300">
                <div className="w-full h-full bg-[#090d16] rounded-[14px] flex items-center justify-center">
                  <Mic className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
                </div>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping opacity-75" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  NutriVoice <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">AI</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Alexa+
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Autonomous MCP Voice Nutrition Assistant
              </p>
            </div>
          </div>

          {/* Center Badges & Status Indicators */}
          <div className="hidden md:flex items-center space-x-3">
            {/* AWS Bedrock Connected Indicator */}
            <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-xs text-slate-300 shadow-sm">
              <div className="relative flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping absolute" />
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
              </div>
              <span className="font-mono text-cyan-300 font-medium">AWS Bedrock Connected</span>
              <span className="text-slate-500">•</span>
              <span className="text-[11px] font-mono text-slate-400">{awsRegion}</span>
            </div>

            {/* Alexa Sync Active Badge */}
            <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="font-medium">Alexa Echo Sync Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* Action Area: Refresh & Model Info */}
          <div className="flex items-center space-x-3">
            <div className="hidden xl:flex flex-col text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Bedrock Engine</span>
              <span className="text-xs font-mono text-slate-300 font-medium">Claude 3.5 Sonnet (Converse)</span>
            </div>

            <button
              onClick={onRefresh}
              disabled={isSyncing}
              title="Refresh telemetry & database state"
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 hover:border-cyan-500/40 transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>

        </div>
      </div>
    </header>
  )
}
