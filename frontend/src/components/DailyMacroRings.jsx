import React from 'react'
import { Flame, Dumbbell, Wheat, Droplets, Target, TrendingUp } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

function MacroGauge({ label, consumed, target, unit = "g", icon: Icon, color, subColor }) {
  const percentage = Math.min(Math.round((consumed / target) * 100), 100)
  const remaining = Math.max(0, target - consumed)

  // Recharts ring data
  const data = [
    { name: 'Consumed', value: consumed },
    { name: 'Remaining', value: remaining }
  ]

  const colorStyles = {
    emerald: {
      stroke: '#10b981',
      bgStroke: 'rgba(16, 185, 129, 0.15)',
      glow: 'shadow-emerald-500/20',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
    },
    cyan: {
      stroke: '#06b6d4',
      bgStroke: 'rgba(6, 182, 212, 0.15)',
      glow: 'shadow-cyan-500/20',
      text: 'text-cyan-400',
      badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
    },
    amber: {
      stroke: '#f59e0b',
      bgStroke: 'rgba(245, 158, 11, 0.15)',
      glow: 'shadow-amber-500/20',
      text: 'text-amber-400',
      badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    },
    violet: {
      stroke: '#8b5cf6',
      bgStroke: 'rgba(139, 92, 246, 0.15)',
      glow: 'shadow-violet-500/20',
      text: 'text-violet-400',
      badge: 'bg-violet-500/10 text-violet-300 border-violet-500/30'
    }
  }

  const activeStyle = colorStyles[color] || colorStyles.emerald

  return (
    <div className="relative rounded-2xl bg-slate-900/60 border border-white/5 p-4 flex flex-col items-center justify-between glass-card-hover">
      
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <div className={`p-1.5 rounded-lg ${activeStyle.badge}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {label}
          </span>
        </div>
        <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${activeStyle.badge}`}>
          {percentage}%
        </span>
      </div>

      {/* Radial Gauge SVG Ring */}
      <div className="relative w-36 h-36 my-2 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={62}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              dataKey="value"
            >
              <Cell key="cell-0" fill={activeStyle.stroke} />
              <Cell key="cell-1" fill={activeStyle.bgStroke} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-extrabold text-white tracking-tight">
            {Math.round(consumed)}
          </span>
          <span className="text-[10px] text-slate-400 font-medium -mt-0.5">
            / {target} {unit}
          </span>
        </div>
      </div>

      {/* Remaining Delta Footer */}
      <div className="w-full text-center pt-2 border-t border-white/5 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">Remaining:</span>
        <span className={`font-mono font-bold ${activeStyle.text}`}>
          {Math.round(remaining)} {unit}
        </span>
      </div>

    </div>
  )
}

export function DailyMacroRings({ summary }) {
  // Target values with fallback to specified defaults:
  // Calories (Target: 2200, Consumed: 1450), Protein (Target: 160, Consumed: 122), Carbs (Target: 220, Consumed: 145), Fats (Target: 65, Consumed: 42)
  const calories = {
    consumed: summary?.consumed_calories ?? 1450,
    target: summary?.target_calories ?? 2200
  }
  const protein = {
    consumed: summary?.consumed_protein_g ?? 122,
    target: summary?.target_protein_g ?? 160
  }
  const carbs = {
    consumed: summary?.consumed_carbs_g ?? 145,
    target: summary?.target_carbs_g ?? 220
  }
  const fats = {
    consumed: summary?.consumed_fat_g ?? 42,
    target: summary?.target_fat_g ?? 65
  }

  const adherence = summary?.adherence_score ?? 66

  return (
    <div className="rounded-3xl glass-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Daily Macro Target Rings
            </h3>
            <p className="text-xs text-slate-400">
              Synchronized from Alexa voice logs & clinical baseline nutrition targets.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Adherence: <strong className="text-emerald-400">{adherence}%</strong></span>
          </div>
        </div>
      </div>

      {/* 4 Radial Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MacroGauge
          label="Calories"
          consumed={calories.consumed}
          target={calories.target}
          unit="kcal"
          icon={Flame}
          color="emerald"
        />
        <MacroGauge
          label="Protein"
          consumed={protein.consumed}
          target={protein.target}
          unit="g"
          icon={Dumbbell}
          color="cyan"
        />
        <MacroGauge
          label="Carbohydrates"
          consumed={carbs.consumed}
          target={carbs.target}
          unit="g"
          icon={Wheat}
          color="amber"
        />
        <MacroGauge
          label="Healthy Fats"
          consumed={fats.consumed}
          target={fats.target}
          unit="g"
          icon={Droplets}
          color="violet"
        />
      </div>

    </div>
  )
}
