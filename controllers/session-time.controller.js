const db = require("../models")
const { sendSuccess, sendError } = require("../utils/responseHelper")

// Get real-time session duration and cost
exports.getSessionRealTimeData = async (req, res) => {
  try {
    const { session_id } = req.params

    const session = await db.tableSessions.findByPk(session_id, {
      include: [
        {
          model: db.tables,
          attributes: ["id", "table_number"],
        },
        {
          model: db.gameTypes,
          attributes: ["id", "name", "pricing_type"],
        },
        {
          model: db.players,
          attributes: ["id", "player_code", "first_name", "last_name"],
          required: false,
        },
      ],
    })

    if (!session) {
      return sendError(res, "Session not found", 404)
    }

    if (session.status !== "active") {
      return sendError(res, "Session is not active", 400)
    }

    // Calculate current duration (backend is source of truth)
    const now = new Date()
    const startTime = new Date(session.start_time)
    const currentDurationMs = now - startTime
    const currentDurationMinutes = Math.ceil(currentDurationMs / (1000 * 60))

    // Get pricing information
    const gamePricing = await db.gamePricing.findOne({
      where: {
        table_id: session.table_id,
        game_type_id: session.game_type_id,
        is_active: true,
      },
    })

    let currentGameCost = 0
    let estimatedFinalCost = 0
    let pricingInfo = {}

    if (gamePricing) {
      if (session.gameType.pricing_type === "fixed") {
        // Fixed price games (like Frames)
        currentGameCost = Number.parseFloat(gamePricing.fixed_price || gamePricing.price)
        estimatedFinalCost = currentGameCost
        pricingInfo = {
          type: "fixed",
          fixed_price: currentGameCost,
          message: "Fixed price per game",
        }
      } else if (session.gameType.pricing_type === "per_minute") {
        // Per-minute pricing (like Century)
        const pricePerMinute = Number.parseFloat(gamePricing.price_per_minute || gamePricing.price)

        if (gamePricing.is_unlimited_time) {
          // Unlimited time - charge for actual duration
          currentGameCost = pricePerMinute * currentDurationMinutes
          estimatedFinalCost = currentGameCost
          pricingInfo = {
            type: "per_minute_unlimited",
            price_per_minute: pricePerMinute,
            current_minutes: currentDurationMinutes,
            message: `₹${pricePerMinute}/minute - Unlimited time`,
          }
        } else {
          // Limited time - charge up to time limit
          const timeLimit = gamePricing.time_limit_minutes || 60
          const billableMinutes = Math.min(currentDurationMinutes, timeLimit)
          currentGameCost = pricePerMinute * billableMinutes
          estimatedFinalCost = pricePerMinute * timeLimit // Maximum possible cost

          pricingInfo = {
            type: "per_minute_limited",
            price_per_minute: pricePerMinute,
            time_limit_minutes: timeLimit,
            current_minutes: currentDurationMinutes,
            billable_minutes: billableMinutes,
            message: `₹${pricePerMinute}/minute - Max ${timeLimit} minutes`,
            time_remaining: Math.max(0, timeLimit - currentDurationMinutes),
          }
        }
      }
    }

    // Get current canteen amount
    const currentCanteenAmount = Number.parseFloat(session.canteen_amount || 0)
    const currentTotalAmount = currentGameCost + currentCanteenAmount

    // Format time for display
    const formatDuration = (minutes) => {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
    }

    const responseData = {
      session_id: session.id,
      session_code: session.session_code,
      table: session.table,
      game_type: session.gameType,
      player: session.player,
      start_time: session.start_time,
      current_time: now,
      duration: {
        milliseconds: currentDurationMs,
        minutes: currentDurationMinutes,
        formatted: formatDuration(currentDurationMinutes),
      },
      costs: {
        current_game_cost: currentGameCost,
        estimated_final_game_cost: estimatedFinalCost,
        current_canteen_amount: currentCanteenAmount,
        current_total: currentTotalAmount,
      },
      pricing_info: pricingInfo,
      status: session.status,
    }

    sendSuccess(res, responseData, "Real-time session data retrieved successfully")
  } catch (err) {
    console.error("Get session real-time data error:", err)
    sendError(res, "Failed to retrieve session data", 500)
  }
}

// Pause session (stops time calculation)
exports.pauseSession = async (req, res) => {
  try {
    const { session_id } = req.params

    const session = await db.tableSessions.findByPk(session_id)
    if (!session) {
      return sendError(res, "Session not found", 404)
    }

    if (session.status !== "active") {
      return sendError(res, "Session is not active", 400)
    }

    // Calculate duration up to pause point
    const now = new Date()
    const pausedDuration = Math.ceil((now - session.start_time) / (1000 * 60))

    await session.update({
      status: "paused",
      paused_at: now,
      paused_duration: pausedDuration,
    })

    sendSuccess(res, session, "Session paused successfully")
  } catch (err) {
    console.error("Pause session error:", err)
    sendError(res, "Failed to pause session", 500)
  }
}

// Resume session (continues time calculation)
exports.resumeSession = async (req, res) => {
  try {
    const { session_id } = req.params

    const session = await db.tableSessions.findByPk(session_id)
    if (!session) {
      return sendError(res, "Session not found", 404)
    }

    if (session.status !== "paused") {
      return sendError(res, "Session is not paused", 400)
    }

    // Adjust start time to account for paused duration
    const now = new Date()
    const pausedDuration = session.paused_duration || 0
    const adjustedStartTime = new Date(now.getTime() - pausedDuration * 60 * 1000)

    await session.update({
      status: "active",
      start_time: adjustedStartTime,
      paused_at: null,
      paused_duration: null,
    })

    sendSuccess(res, session, "Session resumed successfully")
  } catch (err) {
    console.error("Resume session error:", err)
    sendError(res, "Failed to resume session", 500)
  }
}
