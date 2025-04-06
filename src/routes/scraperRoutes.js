import express from 'express';
import mongoose from 'mongoose';
import Logger from '../utils/logger.js';

const router = express.Router();
const logger = new Logger('ScraperRoutes');

// Get submission by ID and return its content
router.get('/submission/:id', async (req, res) => {
    try {
        const submissionId = req.params.id;
        
        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(submissionId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid submission ID format' 
            });
        }
        
        // Get the correct Submission model name
        const Submission = mongoose.model('ScraperSubmission'); // Changed from 'Submission'
        
        // Find submission with populated results
        const submission = await Submission.findById(submissionId);
        
        if (!submission) {
            return res.status(404).json({ 
                success: false, 
                message: 'Submission not found' 
            });
        }
        
        // Return the submission with its results
        return res.json({
            success: true,
            submissionId: submission._id,
            url: submission.url,
            type: submission.type,
            status: submission.status,
            results: submission.results
        });
        
    } catch (error) {
        logger.error(`Error fetching submission content: ${error.message}`);
        return res.status(500).json({ 
            success: false, 
            message: 'Error fetching submission content'
        });
    }
});

export default router;