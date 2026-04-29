import mongoose from "mongoose";
import Note from "../models/note.model.js";

const sendSuccess = (res, status, message, data, extra = {}) => {
  return res.status(status).json({
    success: true,
    message,
    ...extra,
    data
  });
};

const sendError = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
    data: null
  });
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const buildFilter = (query) => {
  const { q, category, isPinned } = query;

  const filter = {};

  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { content: { $regex: q, $options: "i" } }
    ];
  }

  if (category) filter.category = category;

  if (isPinned !== undefined) {
    filter.isPinned = isPinned === "true";
  }

  return filter;
};

const buildSort = (query) => {
  const allowedSortFields = ["title", "createdAt", "updatedAt", "category"];

  const sortField = allowedSortFields.includes(query.sortBy)
    ? query.sortBy
    : "createdAt";

  const sortOrder = query.order === "asc" ? 1 : -1;

  return { [sortField]: sortOrder };
};

const buildPagination = (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const getPaginationData = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

/* 1. CREATE SINGLE NOTE */
export const createNote = async (req, res) => {
  try {
    const { title, content, category, isPinned } = req.body;

    if (!title || !content) {
      return sendError(res, 400, "Title and content are required");
    }

    const note = await Note.create({
      title,
      content,
      category,
      isPinned
    });

    return sendSuccess(res, 201, "Note created successfully", note);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 2. CREATE BULK NOTES */
export const createBulkNotes = async (req, res) => {
  try {
    const { notes } = req.body;

    if (!Array.isArray(notes) || notes.length === 0) {
      return sendError(res, 400, "notes array is required and cannot be empty");
    }

    const createdNotes = await Note.insertMany(notes);

    return sendSuccess(
      res,
      201,
      `${createdNotes.length} notes created successfully`,
      createdNotes
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 3. GET ALL NOTES */
export const getAllNotes = async (req, res) => {
  try {
    const notes = await Note.find();

    return sendSuccess(res, 200, "Notes fetched successfully", notes, {
      count: notes.length
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 4. GET NOTE BY ID */
export const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid note ID");
    }

    const note = await Note.findById(id);

    if (!note) {
      return sendError(res, 404, "Note not found");
    }

    return sendSuccess(res, 200, "Note fetched successfully", note);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 5. PUT FULL REPLACE */
export const replaceNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid note ID");
    }

    if (!title || !content) {
      return sendError(res, 400, "Title and content are required");
    }

    const note = await Note.findOneAndReplace(
      { _id: id },
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!note) {
      return sendError(res, 404, "Note not found");
    }

    return sendSuccess(res, 200, "Note replaced successfully", note);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 6. PATCH PARTIAL UPDATE */
export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid note ID");
    }

    if (Object.keys(req.body).length === 0) {
      return sendError(res, 400, "No fields provided to update");
    }

    const note = await Note.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!note) {
      return sendError(res, 404, "Note not found");
    }

    return sendSuccess(res, 200, "Note updated successfully", note);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 7. DELETE SINGLE NOTE */
export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid note ID");
    }

    const note = await Note.findByIdAndDelete(id);

    if (!note) {
      return sendError(res, 404, "Note not found");
    }

    return sendSuccess(res, 200, "Note deleted successfully", null);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 8. DELETE BULK NOTES */
export const deleteBulkNotes = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, "ids array is required and cannot be empty");
    }

    const hasInvalidId = ids.some((id) => !isValidObjectId(id));

    if (hasInvalidId) {
      return sendError(res, 400, "One or more note ids are invalid");
    }

    const result = await Note.deleteMany({
      _id: { $in: ids }
    });

    return sendSuccess(
      res,
      200,
      `${result.deletedCount} notes deleted successfully`,
      null
    );
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 9. SEARCH TITLE ONLY */
export const searchByTitle = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return sendError(res, 400, "Search query 'q' is required");
    }

    const notes = await Note.find({
      title: { $regex: q, $options: "i" }
    });

    return sendSuccess(res, 200, `Search results for: ${q}`, notes, {
      count: notes.length
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 10. SEARCH CONTENT ONLY */
export const searchByContent = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return sendError(res, 400, "Search query 'q' is required");
    }

    const notes = await Note.find({
      content: { $regex: q, $options: "i" }
    });

    return sendSuccess(res, 200, `Content search results for: ${q}`, notes, {
      count: notes.length
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 11. SEARCH TITLE + CONTENT */
export const searchAll = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return sendError(res, 400, "Search query 'q' is required");
    }

    const notes = await Note.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { content: { $regex: q, $options: "i" } }
      ]
    });

    return sendSuccess(res, 200, `Search results for: ${q}`, notes, {
      count: notes.length
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 12. FILTER + SORT */
export const filterAndSort = async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    delete filter.$or;

    const sort = buildSort(req.query);

    const notes = await Note.find(filter).sort(sort);

    return sendSuccess(res, 200, "Notes fetched successfully", notes, {
      count: notes.length
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 13. FILTER + PAGINATE */
export const filterAndPaginate = async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    delete filter.$or;

    const { page, limit, skip } = buildPagination(req.query);

    const total = await Note.countDocuments(filter);

    const notes = await Note.find(filter)
      .skip(skip)
      .limit(limit);

    return sendSuccess(res, 200, "Notes fetched successfully", notes, {
      pagination: getPaginationData(total, page, limit)
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 14. SORT + PAGINATE */
export const sortAndPaginate = async (req, res) => {
  try {
    const sort = buildSort(req.query);
    const { page, limit, skip } = buildPagination(req.query);

    const total = await Note.countDocuments();

    const notes = await Note.find()
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendSuccess(res, 200, "Notes fetched successfully", notes, {
      pagination: getPaginationData(total, page, limit)
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 15. SEARCH + FILTER */
export const searchAndFilter = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return sendError(res, 400, "Search query 'q' is required");
    }

    const filter = buildFilter(req.query);

    const notes = await Note.find(filter);

    return sendSuccess(res, 200, `Search results for: ${q}`, notes, {
      count: notes.length
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 16. SEARCH + SORT + PAGINATE */
export const searchSortPaginate = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return sendError(res, 400, "Search query 'q' is required");
    }

    const filter = buildFilter(req.query);
    const sort = buildSort(req.query);
    const { page, limit, skip } = buildPagination(req.query);

    const total = await Note.countDocuments(filter);

    const notes = await Note.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendSuccess(res, 200, `Search results for: ${q}`, notes, {
      pagination: getPaginationData(total, page, limit)
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 17. FILTER + SORT + PAGINATE */
export const filterSortPaginate = async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    delete filter.$or;

    const sort = buildSort(req.query);
    const { page, limit, skip } = buildPagination(req.query);

    const total = await Note.countDocuments(filter);

    const notes = await Note.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendSuccess(res, 200, "Notes fetched successfully", notes, {
      pagination: getPaginationData(total, page, limit)
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/* 18. MASTER QUERY */
export const masterQuery = async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const sort = buildSort(req.query);
    const { page, limit, skip } = buildPagination(req.query);

    const total = await Note.countDocuments(filter);

    const notes = await Note.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    return sendSuccess(res, 200, "Notes fetched successfully", notes, {
      pagination: getPaginationData(total, page, limit)
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};