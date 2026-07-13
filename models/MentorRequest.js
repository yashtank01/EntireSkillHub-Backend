const mongoose = require('mongoose');

const mentorRequestSchema = new mongoose.Schema({
    mentorName: {
        type: String,
        required: true
    },
    // We can add the user's name/email later when you build a login system!
    status: {
        type: String,
        default: 'Pending' // All new requests start as Pending
    },
    requestDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('MentorRequest', mentorRequestSchema);