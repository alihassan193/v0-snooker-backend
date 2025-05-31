// Standardized API response helper

const successResponse = (res, message = 'Success', data = null, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

const sendError = (res, message = 'Error occurred', statusCode = 500, errors = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  })
}
const errorResponse = (res, message = 'Error occurred', statusCode = 500, errors = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  })
}

const sendPaginatedResponse = (res, data, pagination, message = 'Success') => {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  })
}

module.exports = {
  sendSuccess,
  sendError,
  sendPaginatedResponse,
  successResponse,
  errorResponse,
}
