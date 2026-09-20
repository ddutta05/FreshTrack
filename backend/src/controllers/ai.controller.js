const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/apiResponse");
const { generateChatResponse } = require("../services/groq.service");

const testChat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const result = await generateChatResponse(message);
  return success(res, 200, "AI response generated", { message: result.message });
});

const chat = asyncHandler(async (req, res) => {
  const result = await generateChatResponse(req.body.message, {
    user: req.user,
    history: req.body.history
  });
  return success(res, 200, "AI response generated", {
    message: result.message,
    recommendations: result.recommendations
  });
});

module.exports = {
  testChat,
  chat
};
