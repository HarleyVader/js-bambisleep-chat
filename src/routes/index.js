import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  const data = req.cookies; // Access cookies from the request
  const validConstantsCount = 9; // Define the variable with an appropriate value
  if (data && data.bambiname) {
    res.render('index', { 
      title: 'Home',
      username: data.bambiname,
      validConstantsCount: validConstantsCount
    });
  } else {
    res.render('index', { 
      title: 'Home',
      username: 'Guest',
      validConstantsCount: validConstantsCount
    });
  }
});

export default router;