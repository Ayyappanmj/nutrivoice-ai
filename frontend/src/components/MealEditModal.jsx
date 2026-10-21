import React, { useState, useEffect } from 'react'
import { X, Save, Trash2, Edit3, Flame, Dumbbell, Wheat, Droplets } from 'lucide-react'

export function MealEditModal({ isOpen, onClose, meal, onSave, onDelete }) {
  if (!isOpen || !meal) return null

  const [formData, setFormData] = useState({
    meal_title: '',
    meal_type: 'lunch',
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0
  })

  useEffect(() => {
    if (meal) {
      setFormData({
        meal_title: meal.meal_title || '',
        meal_type: meal.meal_type || 'lunch',
        calories: meal.calories || 0,
        protein_g: meal.protein_g || 0,
        carbs_g: meal.carbs_g || 0,
        fat_g: meal.fat_g || 0,
        fiber_g: meal.fiber_g || 0
      })
    }
  }, [meal])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(meal.id, {
      meal_title: formData.meal_title,
      meal_type: formData.meal_type,
      calories: parseFloat(formData.calories) || 0,
      protein_g: parseFloat(formData.protein_g) || 0,
      carbs_g: parseFloat(formData.carbs_g) || 0,
      fat_g: parseFloat(formData.fat_g) || 0,
      fiber_g: parseFloat(formData.fiber_g) || 0
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#0b101b] border border-white/10 p-6 shadow-2xl space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Edit Meal Entry</h3>
              <p className="text-xs text-slate-400 font-mono">Meal #{meal.id} • {meal.time}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Meal Title / Description
            </label>
            <input
              type="text"
              value={formData.meal_title}
              onChange={(e) => handleChange('meal_title', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Meal Category
              </label>
              <select
                value={formData.meal_type}
                onChange={(e) => handleChange('meal_type', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                <span>Calories (kcal)</span>
              </label>
              <input
                type="number"
                step="1"
                value={formData.calories}
                onChange={(e) => handleChange('calories', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5 text-cyan-400" />
                <span>Protein (g)</span>
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.protein_g}
                onChange={(e) => handleChange('protein_g', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Wheat className="w-3.5 h-3.5 text-amber-400" />
                <span>Carbs (g)</span>
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.carbs_g}
                onChange={(e) => handleChange('carbs_g', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-violet-400" />
                <span>Fat (g)</span>
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.fat_g}
                onChange={(e) => handleChange('fat_g', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onDelete(meal.id)
                onClose()
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Meal</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  )
}
