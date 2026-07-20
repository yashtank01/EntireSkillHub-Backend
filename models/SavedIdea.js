const mongoose = require('mongoose');

const savedIdeaSchema = new mongoose.Schema({
    ideaName: { type: String, required: true },
    userEmail: { type: String, required: true }, 
    savedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SavedIdea', savedIdeaSchema);