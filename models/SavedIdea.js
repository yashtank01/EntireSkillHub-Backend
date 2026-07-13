const mongoose = require('mongoose');

const savedIdeaSchema = new mongoose.Schema({
    ideaName: {
        type: String,
        required: true
    },
    // We will link this to a specific user later!
    savedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SavedIdea', savedIdeaSchema);