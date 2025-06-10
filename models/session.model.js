module.exports = (sequelize, Sequelize) => {
  const TableSession = sequelize.define(
    'table_sessions',
    {
      session_code: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
      },
      table_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'snooker_tables',
          key: 'id',
        },
      },
      game_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'game_types',
          key: 'id',
        },
      },
      player_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'players',
          key: 'id',
        },
      },
      guest_player_name: {
        type: Sequelize.STRING,
      },
      guest_player_phone: {
        type: Sequelize.STRING,
      },
      is_guest: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      start_time: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      end_time: {
        type: Sequelize.DATE,
      },
      paused_at: {
        type: Sequelize.DATE,
      },
      paused_duration: {
        type: Sequelize.INTEGER,
      },
      duration_minutes: {
        type: Sequelize.INTEGER,
      },
      game_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
      },
      canteen_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('active', 'paused', 'completed', 'cancelled'),
        defaultValue: 'active',
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'partial'),
        defaultValue: 'pending',
      },
      notes: {
        type: Sequelize.TEXT,
      },
      created_by: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
      },
    },
    {
      // <-- This curly brace was missing in your code
      hooks: {
        beforeValidate: async session => {
          if (!session.session_code) {
            try {
              // Get club prefix
              const table = await sequelize.models.tables.findByPk(session.table_id, {
                include: [
                  {
                    model: sequelize.models.clubs,
                    attributes: ['code_prefix', 'id'],
                  },
                ],
              })

              if (!table || !table.club) {
                throw new Error('Table or associated club not found')
              }

              const prefix = table.club.code_prefix || 'SNK'

              // Find last session for this club
              const lastSession = await sequelize.models.table_sessions.findOne({
                include: [
                  {
                    model: sequelize.models.tables,
                    where: { club_id: table.club.id },
                    attributes: [],
                  },
                ],
                order: [['createdAt', 'DESC']],
                attributes: ['session_code'],
              })

              let nextNumber = 1
              if (lastSession?.session_code) {
                const matches = lastSession.session_code.match(/\d+$/)
                if (matches) nextNumber = parseInt(matches[0]) + 1
              }

              session.session_code = `${prefix}${table.club.id}-${String(nextNumber).padStart(4, '0')}`
            } catch (error) {
              console.error('Error generating session code:', error)
              // Fallback to timestamp-based code
              session.session_code = `SNK-${Date.now().toString().slice(-6)}`
            }
          }
        },
      },
    }
  )

  return TableSession
}
