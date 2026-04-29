import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"]
    },
    content: {
      type: String,
      required: [true, "Content is required"]
    },
    category: {
      type: String,
      enum: ["work", "personal", "study"],
      default: "personal"
    },
    isPinned: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Note = mongoose.model("Note", noteSchema);

export default Note;