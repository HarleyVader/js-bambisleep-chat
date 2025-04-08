const express = require('express');
const { ServerStats } = require('../models/stats');
const os = require('os');
const Logger = require('../utils/logger');

// Initialize logger
const logger = new Logger('StatsRouter');

const router = express.Router();

// Auth middleware - only admins can access stats
const isAdmin = (req, res, next) => {
  if (req.session.userId && req.session.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Unauthorized' });
};

// Get overall system stats
router.get('/', isAdmin, async (req, res) => {
  try {
    const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const [
      dailyStats,
      weeklyStats,
      latestCpuUsage,
      latestMemoryUsage,
      latestConnections,
      errorCount
    ] = await Promise.all([
      ServerStats.find({ timestamp: { $gte: lastDay } }),
      ServerStats.find({ timestamp: { $gte: lastWeek } }),
      ServerStats.findOne({ metric: 'cpu' }).sort({ timestamp: -1 }),
      ServerStats.findOne({ metric: 'memory' }).sort({ timestamp: -1 }),
      ServerStats.findOne({ metric: 'connections' }).sort({ timestamp: -1 }),
      ServerStats.countDocuments({ metric: 'errors', timestamp: { $gte: lastDay } })
    ]);
    
    const systemStats = {
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0].model,
        loadAvg: os.loadavg(),
        currentUsage: latestCpuUsage ? latestCpuUsage.value : null
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usagePercent: latestMemoryUsage ? latestMemoryUsage.value : null
      },
      uptime: os.uptime(),
      platform: os.platform(),
      hostname: os.hostname(),
      connections: latestConnections ? latestConnections.value : 0,
      errors: {
        today: errorCount
      }
    };
    
    res.json({
      system: systemStats,
      daily: dailyStats,
      weekly: weeklyStats
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Error fetching statistics' });
  }
});

// Get specific metric stats
router.get('/:metric', isAdmin, async (req, res) => {
  try {
    const { metric } = req.params;
    const { timeframe } = req.query; // 'day', 'week', 'month', 'custom'
    
    let startDate;
    const now = new Date();
    
    switch (timeframe) {
      case 'week':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        startDate = new Date(req.query.from || (now - 24 * 60 * 60 * 1000));
        break;
      case 'day':
      default:
        startDate = new Date(now - 24 * 60 * 60 * 1000);
    }
    
    const stats = await ServerStats.find({
      metric,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });
    
    res.json({
      metric,
      timeframe,
      dataPoints: stats.length,
      data: stats
    });
  } catch (error) {
    logger.error(`Error fetching ${req.params.metric} stats:`, error);
    res.status(500).json({ error: `Error fetching ${req.params.metric} statistics` });
  }
});

// Log a new stat (for internal use)
router.post('/log', isAdmin, async (req, res) => {
  try {
    const { metric, value, metadata } = req.body;
    
    if (!metric || value === undefined) {
      return res.status(400).json({ error: 'Metric and value are required' });
    }
    
    const newStat = await ServerStats.create({
      metric,
      value,
      metadata,
      timestamp: new Date()
    });
    
    res.status(201).json(newStat);
  } catch (error) {
    logger.error('Error logging stat:', error);
    res.status(500).json({ error: 'Error logging statistic' });
  }
});

// Start stats collection service
let statsCollectionInterval;

function startStatsCollection() {
  // Collect stats every minute
  statsCollectionInterval = setInterval(async () => {
    try {
      // Collect CPU usage
      const cpuUsage = os.loadavg()[0] / os.cpus().length * 100; // Normalize to percentage
      
      // Collect memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
      
      // Save stats to database
      await Promise.all([
        ServerStats.create({
          metric: 'cpu',
          value: cpuUsage,
          timestamp: new Date()
        }),
        ServerStats.create({
          metric: 'memory',
          value: memoryUsage,
          timestamp: new Date()
        })
      ]);
      
      logger.debug('Server stats collected and saved');
    } catch (error) {
      logger.error('Error collecting server stats:', error);
    }
  }, 60000); // Every minute
}

// Stop stats collection
function stopStatsCollection() {
  if (statsCollectionInterval) {
    clearInterval(statsCollectionInterval);
  }
}

module.exports = {
  statsRouter: router,
  startStatsCollection,
  stopStatsCollection
};