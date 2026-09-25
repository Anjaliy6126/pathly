import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ================= BOOKMARKS =================

export const createBookmark = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const { opportunityId } = req.body;

    if (!opportunityId || !Number.isInteger(opportunityId) || opportunityId <= 0) {
      return res.status(400).json({ success: false, error: 'Valid opportunityId is required' });
    }

    const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }
    if (!opportunity.isActive) {
      return res.status(400).json({ success: false, error: 'Cannot bookmark an inactive opportunity' });
    }

    try {
      const bookmark = await prisma.studentOpportunityBookmark.create({
        data: {
          studentId,
          opportunityId
        }
      });
      return res.status(201).json({ success: true, data: bookmark });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'Opportunity is already bookmarked' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Create bookmark error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteBookmark = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const bookmarkId = parseInt(req.params.bookmarkId, 10);

    const bookmark = await prisma.studentOpportunityBookmark.findUnique({
      where: { id: bookmarkId }
    });

    if (!bookmark) {
      return res.status(404).json({ success: false, error: 'Bookmark not found' });
    }

    if (bookmark.studentId !== studentId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await prisma.studentOpportunityBookmark.delete({
      where: { id: bookmarkId }
    });

    res.status(200).json({ success: true, data: null });
  } catch (error) {
    console.error('Delete bookmark error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getBookmarks = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum <= 0) return res.status(400).json({ success: false, error: 'Invalid page' });
    if (isNaN(limitNum) || limitNum <= 0) return res.status(400).json({ success: false, error: 'Invalid limit' });
    
    const maxLimit = Math.min(limitNum, 100);
    const skip = (pageNum - 1) * maxLimit;

    const [bookmarks, total] = await Promise.all([
      prisma.studentOpportunityBookmark.findMany({
        where: { studentId },
        skip,
        take: maxLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              organization: true,
              type: true,
              workMode: true,
              location: true,
              cycles: true
            }
          }
        }
      }),
      prisma.studentOpportunityBookmark.count({ where: { studentId } })
    ]);

    const mappedBookmarks = bookmarks.map(b => {
      let currentCycle = null;
      if (b.opportunity.cycles && b.opportunity.cycles.length > 0) {
        const openCycle = b.opportunity.cycles.find(c => c.status === 'OPEN');
        const upcomingCycle = b.opportunity.cycles.find(c => c.status === 'UPCOMING');
        if (openCycle) {
          currentCycle = openCycle;
        } else if (upcomingCycle) {
          currentCycle = upcomingCycle;
        } else {
          currentCycle = b.opportunity.cycles.sort((c1, c2) => {
            const d1 = c1.applicationDeadline || c1.startDate || c1.createdAt;
            const d2 = c2.applicationDeadline || c2.startDate || c2.createdAt;
            return new Date(d2) - new Date(d1);
          })[0];
        }
      }
      
      const { cycles, ...cleanOpp } = b.opportunity;
      return {
        ...b,
        opportunity: {
          ...cleanOpp,
          currentCycle
        }
      };
    });

    res.status(200).json({
      success: true,
      data: {
        bookmarks: mappedBookmarks,
        pagination: {
          page: pageNum,
          limit: maxLimit,
          total,
          totalPages: Math.ceil(total / maxLimit)
        }
      }
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const checkBookmark = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const opportunityId = parseInt(req.params.opportunityId, 10);

    const bookmark = await prisma.studentOpportunityBookmark.findUnique({
      where: {
        studentId_opportunityId: {
          studentId,
          opportunityId
        }
      }
    });

    if (bookmark) {
      res.status(200).json({
        success: true,
        data: { bookmarked: true, bookmark }
      });
    } else {
      res.status(200).json({
        success: true,
        data: { bookmarked: false, bookmark: null }
      });
    }
  } catch (error) {
    console.error('Check bookmark error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};


// ================= APPLICATIONS =================

export const createApplication = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const { opportunityId, notes } = req.body;

    if (!opportunityId || !Number.isInteger(opportunityId) || opportunityId <= 0) {
      return res.status(400).json({ success: false, error: 'Valid opportunityId is required' });
    }
    
    if (notes && notes.length > 5000) {
       return res.status(400).json({ success: false, error: 'Notes exceed maximum length' });
    }

    const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opportunity) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }
    if (!opportunity.isActive) {
      return res.status(400).json({ success: false, error: 'Cannot track application for an inactive opportunity' });
    }

    try {
      const application = await prisma.studentOpportunityApplication.create({
        data: {
          studentId,
          opportunityId,
          status: 'APPLIED',
          appliedAt: new Date(),
          notes
        }
      });
      return res.status(201).json({ success: true, data: application });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, error: 'Application already exists for this opportunity' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateApplication = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const applicationId = parseInt(req.params.applicationId, 10);
    const { status, notes } = req.body;

    const validStatuses = ['SAVED', 'APPLIED', 'SHORTLISTED', 'REJECTED', 'SELECTED', 'WITHDRAWN'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const application = await prisma.studentOpportunityApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (application.studentId !== studentId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (status) {
      updateData.status = status;
      if (status === 'APPLIED' && !application.appliedAt) {
        updateData.appliedAt = new Date();
      }
    }

    const updatedApp = await prisma.studentOpportunityApplication.update({
      where: { id: applicationId },
      data: updateData
    });

    res.status(200).json({ success: true, data: updatedApp });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getApplications = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum <= 0) return res.status(400).json({ success: false, error: 'Invalid page' });
    if (isNaN(limitNum) || limitNum <= 0) return res.status(400).json({ success: false, error: 'Invalid limit' });
    
    const maxLimit = Math.min(limitNum, 100);
    const skip = (pageNum - 1) * maxLimit;

    const validStatuses = ['SAVED', 'APPLIED', 'SHORTLISTED', 'REJECTED', 'SELECTED', 'WITHDRAWN'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const filters = { studentId };
    if (status) filters.status = status;

    const [applications, total] = await Promise.all([
      prisma.studentOpportunityApplication.findMany({
        where: filters,
        skip,
        take: maxLimit,
        orderBy: { updatedAt: 'desc' },
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              organization: true,
              type: true,
              workMode: true,
              location: true,
              cycles: true
            }
          }
        }
      }),
      prisma.studentOpportunityApplication.count({ where: filters })
    ]);

    const mappedApplications = applications.map(a => {
      let currentCycle = null;
      if (a.opportunity.cycles && a.opportunity.cycles.length > 0) {
        const openCycle = a.opportunity.cycles.find(c => c.status === 'OPEN');
        const upcomingCycle = a.opportunity.cycles.find(c => c.status === 'UPCOMING');
        if (openCycle) {
          currentCycle = openCycle;
        } else if (upcomingCycle) {
          currentCycle = upcomingCycle;
        } else {
          currentCycle = a.opportunity.cycles.sort((c1, c2) => {
            const d1 = c1.applicationDeadline || c1.startDate || c1.createdAt;
            const d2 = c2.applicationDeadline || c2.startDate || c2.createdAt;
            return new Date(d2) - new Date(d1);
          })[0];
        }
      }
      
      const { cycles, ...cleanOpp } = a.opportunity;
      return {
        ...a,
        opportunity: {
          ...cleanOpp,
          currentCycle
        }
      };
    });

    res.status(200).json({
      success: true,
      data: {
        applications: mappedApplications,
        pagination: {
          page: pageNum,
          limit: maxLimit,
          total,
          totalPages: Math.ceil(total / maxLimit)
        }
      }
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getApplication = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const applicationId = parseInt(req.params.applicationId, 10);

    const application = await prisma.studentOpportunityApplication.findUnique({
      where: { id: applicationId },
      include: {
        opportunity: {
          select: {
            id: true,
            title: true,
            organization: true,
            type: true,
            workMode: true,
            location: true,
            cycles: true
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (application.studentId !== studentId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    let currentCycle = null;
    if (application.opportunity.cycles && application.opportunity.cycles.length > 0) {
      const openCycle = application.opportunity.cycles.find(c => c.status === 'OPEN');
      const upcomingCycle = application.opportunity.cycles.find(c => c.status === 'UPCOMING');
      if (openCycle) {
        currentCycle = openCycle;
      } else if (upcomingCycle) {
        currentCycle = upcomingCycle;
      } else {
        currentCycle = application.opportunity.cycles.sort((c1, c2) => {
          const d1 = c1.applicationDeadline || c1.startDate || c1.createdAt;
          const d2 = c2.applicationDeadline || c2.startDate || c2.createdAt;
          return new Date(d2) - new Date(d1);
        })[0];
      }
    }

    const { cycles, ...cleanOpp } = application.opportunity;
    const result = {
      ...application,
      opportunity: {
        ...cleanOpp,
        currentCycle
      }
    };

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteApplication = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const applicationId = parseInt(req.params.applicationId, 10);

    const application = await prisma.studentOpportunityApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    if (application.studentId !== studentId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await prisma.studentOpportunityApplication.delete({
      where: { id: applicationId }
    });

    res.status(200).json({ success: true, data: null });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
