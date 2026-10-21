import React, { useState } from 'react'
import { Utensils, Clock, MoreVertical, Edit2, Trash2, AlertCircle, Plus, Sparkles, Check } from 'lucide-react'
import { MealEditModal } from './MealEditModal'

export function RecentMealsStream({ meals, onUpdateMeal, onDeleteMeal, onAddSampleMeal }) {
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filterType, setFilterType] = useState('all')

  const handleEditClick = (meal) => {
    setSelectedMeal(meal)
    setIsModalOpen(true)
  }

  const filteredMeals = meals.filter(m => {
    if (filterType === 'all') return true
    return m.meal_type?.toLowerCase() === filterType.toLowerCase()
  })

  return (
    <div className="rounded-3xl glass-card p-6 space-y-5">
      {/* Stream Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Recent Meals Stream
            </h3>
            <p className="text-xs text-slate-400">
              Live streaming feed of voice and MCP-logged nutritional items.
            </p>
          </div>
        </div>

        {/* Filters and Add button */}
        <div className="flex items-center space-x-2 self-stretch sm:self-auto">
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/5 text-xs font-medium">
            {['all', 'breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                  filterType === type
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            onClick={onAddSampleMeal}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
            title="Add a sample meal record"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Meal</span>
          </button>
        </div>
      </div>

      {/* Meals Feed / Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              <th className="py-3 px-3">Time & Type</th>
              <th className="py-3 px-3">Meal Items</th>
              <th className="py-3 px-3 text-right">Calories</th>
              <th className="py-3 px-3 text-center">Macros (P / C / F)</th>
              <th className="py-3 px-3">Source & Status</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {filteredMeals.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                  No meals found matching this filter. Speak via Alexa to log your next meal!
                </td>
              </tr>
            ) : (
              filteredMeals.map((meal) => {
                const itemsList = meal.items || []
                return (
                  <tr key={meal.id} className="hover:bg-slate-900/40 transition-colors group">
                    
                    {/* Time & Type */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {meal.time || '12:30 PM'}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                          meal.meal_type === 'breakfast' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          meal.meal_type === 'lunch' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          meal.meal_type === 'dinner' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                          'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}>
                          {meal.meal_type}
                        </span>
                      </div>
                    </td>

                    {/* Meal Items */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                        {meal.meal_title || 'Meal Entry'}
                      </div>
                      {itemsList.length > 0 && (
                        <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {itemsList.map(i => `${i.name} (${i.portion || '1 serving'})`).join(' • ')}
                        </div>
                      )}
                    </td>

                    {/* Calories */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {Math.round(meal.calories)}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1">kcal</span>
                    </td>

                    {/* Macro Badges */}
                    <td className="py-3.5 px-3 whitespace-nowrap text-center">
                      <div className="inline-flex items-center space-x-1.5 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-cyan-950/50 text-cyan-400 border border-cyan-500/20" title="Protein">
                          {Math.round(meal.protein_g)}g P
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-950/50 text-amber-400 border border-amber-500/20" title="Carbohydrates">
                          {Math.round(meal.carbs_g)}g C
                        </span>
                        <span className="px-2 py-0.5 rounded bg-violet-950/50 text-violet-400 border border-violet-500/20" title="Fats">
                          {Math.round(meal.fat_g)}g F
                        </span>
                      </div>
                    </td>

                    {/* Source & Ambiguity */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                          {meal.source || 'Alexa Echo Show'}
                        </span>
                        {meal.has_ambiguity && (
                          <span
                            className="inline-flex items-center text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30"
                            title={meal.disambiguation_prompt || "Ambiguity clarified"}
                          >
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Clarified
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleEditClick(meal)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                          title="Edit meal"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteMeal(meal.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Delete meal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <MealEditModal
        isOpen={isModalOpen}
        meal={selectedMeal}
        onClose={() => setIsModalOpen(false)}
        onSave={onUpdateMeal}
        onDelete={onDeleteMeal}
      />
    </div>
  )
}
