import express from 'express';
import Token from '../models/Token.js'; // make sure the path is correct

const router = express.Router();

// ----------------------
// ✅ Existing Code (KEEP AS IS)
// ----------------------

// Take token
router.post('/take-token', async (req, res) => {
  try {
    console.log("✅ /take-token called:", req.body); // debug log

    const { patientName, phone } = req.body;

    if (!patientName || !phone) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }

    // Check if patient already has a pending token
    const existing = await Token.findOne({ phone, status: 'pending' });
    if (existing) {
      return res.status(400).json({ message: 'You already have a pending token' });
    }

    // Create new token
    const token = new Token({ patientName, phone });
    await token.save();

    res.json({ message: 'Token generated successfully', token });
  } catch (err) {
    console.error("Error in /take-token:", err);
    res.status(500).json({ message: 'Server error while creating token' });
  }
});

// Get all tokens for a patient
router.get('/patient/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const tokens = await Token.find({ phone }).sort({ tokenTime: -1 });
    res.json(tokens);
  } catch (err) {
    console.error("Error fetching tokens:", err);
    res.status(500).json({ message: 'Server error while fetching tokens' });
  }
});

// ----------------------
// ✅ New Staff Routes (Safe Additions)
// ----------------------

// Get all tokens (for staff dashboard)
router.get('/all', async (req, res) => {
  try {
    const tokens = await Token.find().sort({ tokenTime: 1 });
    res.json(tokens);
  } catch (err) {
    console.error('Error fetching all tokens:', err);
    res.status(500).json({ message: 'Server error while fetching all tokens' });
  }
});

// Update token status (done, waiting, etc.)
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Token.findByIdAndUpdate(id, { status });
    res.json({ message: 'Token status updated' });
  } catch (err) {
    console.error('Error updating token status:', err);
    res.status(500).json({ message: 'Server error while updating token' });
  }
});

// Delete token
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Token.findByIdAndDelete(id);
    res.json({ message: 'Token deleted successfully' });
  } catch (err) {
    console.error('Error deleting token:', err);
    res.status(500).json({ message: 'Server error while deleting token' });
  }
});

// Get today's tokens
router.get('/today', async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const tokens = await Token.find({
      tokenTime: { $gte: start, $lte: end }
    }).sort({ tokenNumber: 1 }); // use tokenNumber, not tokenTime

    res.json(tokens);
  } catch(err) {
    console.error('Error fetching today tokens:', err);
    res.status(500).json({ message: 'Server error fetching today tokens' });
  }
});

// Get tokens by date
router.get('/date/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);

    const tokens = await Token.find({
      tokenTime: { $gte: start, $lte: end }
    }).sort({ tokenNumber: 1 }); // use tokenNumber, not tokenTime

    res.json(tokens);
  } catch(err) {
    console.error('Error fetching tokens by date:', err);
    res.status(500).json({ message: 'Server error fetching tokens by date' });
  }
});

// Get today's tokens
router.get('/today', async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const tokens = await Token.find({
      tokenTime: { $gte: start, $lte: end }
    }).sort({ tokenTime: 1 });

    res.json(tokens);
  } catch(err) {
    console.error('Error fetching today tokens:', err);
    res.status(500).json({ message: 'Server error fetching today tokens' });
  }
});

// Get tokens by date
router.get('/date/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);

    const tokens = await Token.find({
      tokenTime: { $gte: start, $lte: end }
    }).sort({ tokenTime: 1 });

    res.json(tokens);
  } catch(err) {
    console.error('Error fetching tokens by date:', err);
    res.status(500).json({ message: 'Server error fetching tokens by date' });
  }
});

// Doctor updates patient info
router.patch('/doctor-update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, medicine, nextVisit, status } = req.body;

    const updated = await Token.findByIdAndUpdate(
      id,
      { diagnosis, medicine, nextVisit, status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Token not found" });

    res.json({ message: "Patient details updated", token: updated });
  } catch (err) {
    console.error("Error updating token by doctor:", err);
    res.status(500).json({ message: "Server error while updating patient details" });
  }
});


export default router;
