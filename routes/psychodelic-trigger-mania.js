import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  const validConstantsCount = 9; // Define the variable with an appropriate value

  res.render('psychodelic-trigger-mania', { 
    validConstantsCount: validConstantsCount
  });
});

export default router;