const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  messages: [
    {
      sender: {
        type: String,
        enum: ["user", "bot"],
        required: true
      },
      text: {
        type: String,
        required: true
      },
      time: String
    }
  ]
});

module.exports = mongoose.model("Chat", chatSchema);
