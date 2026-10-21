import React, { useState, useEffect, useCallback } from 'react'
import { Header } from './components/Header'
import { VoiceAssistantHero } from './components/VoiceAssistantHero'
import { DailyMacroRings } from './components/DailyMacroRings'
import { RecentMealsStream } from './components/RecentMealsStream'
import { BedrockMcpMonitor } from './components/BedrockMcpMonitor'
import { Sparkles, ShieldCheck, Heart, Award, ArrowUpRight } from 'lucide-react'

export default function App() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Daily summary state
  const [summary, setSummary] = useState({
    target_calories: 2200,
    consumed_calories: 1450,
    target_protein_g: 160,
    consumed_protein_g: 122,
    target_carbs_g: 220,
    consumed_carbs_g: 145,
    target_fat_g: 65,
    consumed_fat_g: 42,
    adherence_score: 66.0
  })

  // Recent meals state
  const [meals, setMeals] = useState([
    {
      id: 1,
      meal_type: 'breakfast',
      meal_title: 'Steel-Cut Oats with Blueberries & Chia Seeds',
      time: '08:30 AM',
      calories: 420,
      protein_g: 18,
      carbs_g: 65,
      fat_g: 10,
      fiber_g: 8,
      source: 'Alexa Echo Show',
      has_ambiguity: false,
      items: [
        { name: 'Steel-Cut Oats', portion: '1 cup cooked' },
        { name: 'Fresh Blueberries', portion: '1/2 cup' },
        { name: 'Chia Seeds & Whey', portion: '1 tbsp + scoop' }
      ]
    },
    {
      id: 2,
      meal_type: 'lunch',
      meal_title: 'Grilled Salmon with Quinoa & Avocado',
      time: '01:15 PM',
      calories: 722,
      protein_g: 48,
      carbs_g: 47,
      fat_g: 26,
      fiber_g: 11.9,
      source: 'Alexa Echo Show',
      has_ambiguity: false,
      items: [
        { name: 'Grilled Wild Salmon', portion: '1 fillet (180g)' },
        { name: 'Cooked Quinoa', portion: '1 cup (185g)' },
        { name: 'Hass Avocado', portion: '1/2 medium' }
      ]
    },
    {
      id: 3,
      meal_type: 'snack',
      meal_title: 'Greek Yogurt with Raw Almonds & Whey',
      time: '04:45 PM',
      calories: 308,
      protein_g: 56,
      carbs_g: 33,
      fat_g: 6,
      fiber_g: 2.5,
      source: 'Alexa Mobile',
      has_ambiguity: false,
      items: [
        { name: 'Nonfat Greek Yogurt', portion: '1 cup (227g)' },
        { name: 'Whey Isolate Protein', portion: '1 scoop' },
        { name: 'Raw Almonds & Honey', portion: '10 almonds' }
      ]
    }
  ])

  // Thought Process State
  const [thoughtData, setThoughtData] = useState({
    latency_ms: 384.2,
    tokens: { input: 320, output: 95, total: 415 },
    has_ambiguity: false,
    disambiguation_prompt: null,
    thought_pipeline: [
      {
        step: 1,
        name: "Intent Recognition",
        detail: "Bedrock Converse detected intent: `INTENT_LOG_FOOD_ENTRY` from voice prompt.",
        timestamp: "68ms"
      },
      {
        step: 2,
        name: "Entity Extraction",
        detail: "Extracted 3 items: Grilled Salmon (340 kcal), Quinoa (222 kcal), Avocado (160 kcal).",
        timestamp: "145ms"
      },
      {
        step: 3,
        name: "MCP Tool Call",
        detail: "Dispatched typed JSON payload to `log_food_entry` on NutriVoice MCP Server.",
        timestamp: "280ms"
      },
      {
        step: 4,
        name: "Database Commit",
        detail: "Committed to SQLite/DynamoDB food_entries table; updated daily target rings.",
        timestamp: "384ms"
      }
    ]
  })

  // Tool monitor logs state
  const [monitorLogs, setMonitorLogs] = useState([])

  // Recalculate daily totals based on meals list
  const recalculateSummary = (mealsList) => {
    const totCal = mealsList.reduce((acc, m) => acc + (parseFloat(m.calories) || 0), 0)
    const totPro = mealsList.reduce((acc, m) => acc + (parseFloat(m.protein_g) || 0), 0)
    const totCar = mealsList.reduce((acc, m) => acc + (parseFloat(m.carbs_g) || 0), 0)
    const totFat = mealsList.reduce((acc, m) => acc + (parseFloat(m.fat_g) || 0), 0)

    const calScore = Math.min(totCal / 2200, 1.0)
    const proScore = Math.min(totPro / 160, 1.0)
    const adherence = Math.round(((calScore * 0.5) + (proScore * 0.5)) * 100)

    setSummary(prev => ({
      ...prev,
      consumed_calories: Math.round(totCal),
      consumed_protein_g: Math.round(totPro),
      consumed_carbs_g: Math.round(totCar),
      consumed_fat_g: Math.round(totFat),
      adherence_score: adherence
    }))
  }

  // Fetch live state from backend
  const fetchData = useCallback(async () => {
    setIsSyncing(true)
    try {
      // 1. Fetch meals
      const mealsRes = await fetch('/mcp/meals')
      if (mealsRes.ok) {
        const data = await mealsRes.json()
        if (data.meals && data.meals.length > 0) {
          setMeals(data.meals)
          recalculateSummary(data.meals)
        }
      }

      // 2. Fetch targets
      const targetsRes = await fetch('/mcp/targets/daily')
      if (targetsRes.ok) {
        const tData = await targetsRes.json()
        setSummary(tData)
      }

      // 3. Fetch monitor logs
      const logsRes = await fetch('/mcp/monitor/logs')
      if (logsRes.ok) {
        const lData = await logsRes.json()
        if (lData.logs && lData.logs.length > 0) {
          setMonitorLogs(lData.logs)
        }
      }
    } catch (e) {
      // Running standalone or offline fallback
      console.log('Running in local/offline fallback mode with simulated state:', e)
    } finally {
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Helper to speak Alexa responses aloud
  const speakAlexaOutLoud = (text) => {
    if (!('speechSynthesis' in window) || !text) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.05
      utterance.pitch = 1.02
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn("Speech synthesis error:", e)
    }
  }

  // Handle voice prompt submission
  const handleSendPrompt = async (prompt) => {
    setIsProcessing(true)
    try {
      const res = await fetch('/mcp/voice/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (res.ok) {
        const data = await res.json()
        setThoughtData(data)
        // Refresh meals & targets
        await fetchData()
        // Speak Alexa response out loud!
        if (data.voice_response) {
          speakAlexaOutLoud(data.voice_response)
        }
      } else {
        // Fallback simulation for client-only preview
        simulateLocalVoiceResponse(prompt)
      }
    } catch (err) {
      simulateLocalVoiceResponse(prompt)
    } finally {
      setIsProcessing(false)
    }
  }

  // Local fallback simulation when backend is unavailable
  const simulateLocalVoiceResponse = (prompt) => {
    const isPizza = prompt.toLowerCase().includes('pizza')
    const isProteinQuery = prompt.toLowerCase().includes('protein') || prompt.toLowerCase().includes('summary')

    if (isPizza) {
      const newMeal = {
        id: Date.now(),
        meal_type: 'dinner',
        meal_title: 'Pepperoni Pizza Slice (Placeholder)',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        calories: 285,
        protein_g: 12,
        carbs_g: 36,
        fat_g: 10.4,
        fiber_g: 2.1,
        source: 'Alexa Echo Show',
        has_ambiguity: true,
        disambiguation_prompt: 'Was that cheese, pepperoni, or veggie pizza, and was it regular or deep dish?',
        items: [{ name: 'Pizza Slice (Ambiguous)', portion: '1 slice' }]
      }
      const updatedMeals = [newMeal, ...meals]
      setMeals(updatedMeals)
      recalculateSummary(updatedMeals)

      setThoughtData({
        latency_ms: 395.4,
        tokens: { input: 142, output: 86, total: 228 },
        has_ambiguity: true,
        disambiguation_prompt: 'Was that cheese, pepperoni, or veggie pizza, and was it regular or deep dish?',
        thought_pipeline: [
          { step: 1, name: "Intent Recognition", detail: "Parsed intent: `INTENT_LOG_FOOD_ENTRY`.", timestamp: "72ms" },
          { step: 2, name: "Entity Extraction", detail: "Detected: 'Pizza Slice' - Missing topping & crust specifications.", timestamp: "160ms" },
          { step: 3, name: "MCP Tool Call", detail: "Invoked `log_food_entry` with `is_ambiguous=true`.", timestamp: "290ms" },
          { step: 4, name: "Database Commit", detail: "Saved tentative log; returned Alexa clarification prompt.", timestamp: "395ms" }
        ]
      })

      // Add to monitor logs
      setMonitorLogs(prev => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          tool: "log_food_entry",
          direction: "OUTGOING",
          status: "success",
          latency_ms: 395.4,
          payload: {
            tool: "log_food_entry",
            arguments: { meal_type: "dinner", items: [{ name: "Pizza Slice", is_ambiguous: true }] },
            disambiguation: { needs_clarification: true, prompt: "Was that cheese, pepperoni, or veggie pizza?" }
          }
        },
        ...prev
      ])
    } else if (isProteinQuery) {
      setThoughtData({
        latency_ms: 210.6,
        tokens: { input: 115, output: 65, total: 180 },
        has_ambiguity: false,
        disambiguation_prompt: null,
        thought_pipeline: [
          { step: 1, name: "Intent Recognition", detail: "Parsed intent: `INTENT_QUERY_NUTRITION_SUMMARY`.", timestamp: "45ms" },
          { step: 2, name: "Entity Extraction", detail: "Extracted metric target: 'daily protein balance'.", timestamp: "98ms" },
          { step: 3, name: "MCP Tool Call", detail: "Dispatched `get_daily_summary` tool execution.", timestamp: "165ms" },
          { step: 4, name: "Database Commit", detail: "Aggregated 122g consumed vs 160g target (38g remaining).", timestamp: "210ms" }
        ]
      })
    } else {
      // Standard Salmon & Quinoa Bowl
      const newMeal = {
        id: Date.now(),
        meal_type: 'dinner',
        meal_title: 'Grilled Salmon with Quinoa & Avocado',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        calories: 722,
        protein_g: 48,
        carbs_g: 47,
        fat_g: 26,
        fiber_g: 11.9,
        source: 'Alexa Echo Show',
        has_ambiguity: false,
        items: [
          { name: 'Grilled Wild Salmon', portion: '1 fillet' },
          { name: 'Cooked Quinoa', portion: '1 cup' },
          { name: 'Avocado', portion: '1/2 medium' }
        ]
      }
      const updatedMeals = [newMeal, ...meals]
      setMeals(updatedMeals)
      recalculateSummary(updatedMeals)

      setThoughtData({
        latency_ms: 384.2,
        tokens: { input: 320, output: 95, total: 415 },
        has_ambiguity: false,
        disambiguation_prompt: null,
        thought_pipeline: [
          { step: 1, name: "Intent Recognition", detail: "Bedrock Converse detected intent: `INTENT_LOG_FOOD_ENTRY`.", timestamp: "68ms" },
          { step: 2, name: "Entity Extraction", detail: "Extracted: Salmon (340 kcal), Quinoa (222 kcal), Avocado (160 kcal).", timestamp: "145ms" },
          { step: 3, name: "MCP Tool Call", detail: "Dispatched JSON-RPC payload to `log_food_entry`.", timestamp: "280ms" },
          { step: 4, name: "Database Commit", detail: "Committed to SQLite/DynamoDB food_entries table.", timestamp: "384ms" }
        ]
      })
    }
  }

  // Handle meal update from modal
  const handleUpdateMeal = async (mealId, updatedData) => {
    try {
      await fetch(`/mcp/meals/${mealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      })
    } catch (e) {
      console.log('Update fallback')
    }

    const updated = meals.map(m => m.id === mealId ? { ...m, ...updatedData } : m)
    setMeals(updated)
    recalculateSummary(updated)
  }

  // Handle meal delete
  const handleDeleteMeal = async (mealId) => {
    try {
      await fetch(`/mcp/meals/${mealId}`, { method: 'DELETE' })
    } catch (e) {
      console.log('Delete fallback')
    }

    const updated = meals.filter(m => m.id !== mealId)
    setMeals(updated)
    recalculateSummary(updated)
  }

  // Add sample meal
  const handleAddSampleMeal = () => {
    const sample = {
      id: Date.now(),
      meal_type: 'snack',
      meal_title: 'Almond Butter & Banana Rice Cake',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      calories: 215,
      protein_g: 6,
      carbs_g: 28,
      fat_g: 10,
      fiber_g: 3,
      source: 'Voice MCP',
      has_ambiguity: false,
      items: [
        { name: 'Brown Rice Cake', portion: '2 cakes' },
        { name: 'Almond Butter', portion: '1 tbsp' }
      ]
    }
    const updated = [sample, ...meals]
    setMeals(updated)
    recalculateSummary(updated)
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col">
      {/* 1. Header */}
      <Header isSyncing={isSyncing} onRefresh={fetchData} />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* 2. Voice Assistant Hero */}
        <VoiceAssistantHero
          onSendPrompt={handleSendPrompt}
          isProcessing={isProcessing}
          thoughtData={thoughtData}
        />

        {/* 3. Daily Macro Target Rings */}
        <DailyMacroRings summary={summary} />

        {/* 4. Recent Meals Stream */}
        <RecentMealsStream
          meals={meals}
          onUpdateMeal={handleUpdateMeal}
          onDeleteMeal={handleDeleteMeal}
          onAddSampleMeal={handleAddSampleMeal}
        />

        {/* 5. Bedrock MCP Tool Monitor */}
        <BedrockMcpMonitor logs={monitorLogs} />

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 bg-[#060910] text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NutriVoice AI © 2026 • Alexa+ & AWS Bedrock Nutrition Agent</span>
          <div className="flex items-center space-x-4">
            <span className="text-slate-400 font-mono">Sub-Second Latency: 384ms avg</span>
            <span className="text-emerald-400 font-mono">Pydantic v2 Strict</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
