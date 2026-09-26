import { Recipe } from "../models/Recipe.js";
import { Comment } from "../models/Comment.js";
import  User  from "../models/User.js";

// GET /api/recipes
// Public — list all published recipes, optional ?search= query
export const getRecipes = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;

    const filter = { published: true };

    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { tags: { $in: [new RegExp(search.trim(), "i")] } },
        { category: { $regex: search.trim(), $options: "i" } },
        { authorName: { $regex: search.trim(), $options: "i" } },
      ];
    }

    if (category && category !== "All") {
      filter.category = { $regex: `^${category.trim()}$`, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [recipes, total] = await Promise.all([
      Recipe.find(filter)
        .select(
          "title slug description image authorName category tags cookTime prepTime servings createdAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Recipe.countDocuments(filter),
    ]);

    res.status(200).json({
      recipes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("getRecipes error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// GET /api/recipes/:slug
// Public — single recipe detail
export const getRecipeBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const recipe = await Recipe.findOne({ slug, published: true }).populate(
      "author",
      "username email"
    );

    if (!recipe) {
      return res
        .status(404)
        .json({ error: "Not Found", message: "Recipe not found" });
    }

    res.status(200).json({ recipe });
  } catch (error) {
    console.error("getRecipeBySlug error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// GET /api/recipes/:slug/comments
// Public — fetch all comments for a recipe
export const getComments = async (req, res) => {
  try {
    const { slug } = req.params;

    const recipe = await Recipe.findOne({ slug, published: true }).select(
      "_id"
    );
    if (!recipe) {
      return res
        .status(404)
        .json({ error: "Not Found", message: "Recipe not found" });
    }

    const comments = await Comment.find({ recipe: recipe._id })
      .populate("user", "username name")
      .sort({ createdAt: -1 });

    res.status(200).json({ comments });
  } catch (error) {
    console.error("getComments error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// POST /api/recipes/:slug/comments
// Protected — create a comment (authenticated users only)
export const createComment = async (req, res) => {
  try {
    const { slug } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ error: "Validation", message: "Comment text is required" });
    }

    if (text.trim().length > 1000) {
      return res.status(400).json({
        error: "Validation",
        message: "Comment cannot exceed 1000 characters",
      });
    }

    const recipe = await Recipe.findOne({ slug, published: true }).select(
      "_id"
    );
    if (!recipe) {
      return res
        .status(404)
        .json({ error: "Not Found", message: "Recipe not found" });
    }

    // req.user is populated by verifyToken middleware
    const userId = req.user.id;

    const comment = new Comment({
      recipe: recipe._id,
      user: userId,
      text: text.trim(),
    });

    await comment.save();

    // Populate user info to return in response
    const populated = await comment.populate("user", "username name");

    res.status(201).json({ comment: populated });
  } catch (error) {
    console.error("createComment error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// GET /api/recipes/categories
// Public — list all unique categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Recipe.distinct("category", { published: true });
    res.status(200).json({ categories });
  } catch (error) {
    console.error("getCategories error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// POST /api/recipes
// Protected — create a new recipe post
export const createRecipe = async (req, res) => {
  try {
    const {
      title,
      description,
      content = "",
      image = "",
      category = "General",
      tags = [],
      cookTime = "",
      prepTime = "",
      servings = 4,
      ingredients = [],
      steps = [],
    } = req.body;

    if (!title || !title.trim()) {
      return res
        .status(400)
        .json({ error: "Validation", message: "Title is required" });
    }

    if (!description || !description.trim()) {
      return res
        .status(400)
        .json({ error: "Validation", message: "Description is required" });
    }

    // Generate base slug
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    if (!slug) {
      slug = `recipe-${Date.now()}`;
    }

    // Ensure slug uniqueness
    const existing = await Recipe.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Fetch author details
    const userId = req.user.id;
    const user = await User.findById(userId).select("username name");
    const authorName =
      user?.name && user.name.trim() ? user.name.trim() : user?.username || "Chef";

    // Format tags if passed as string or array
    const formattedTags = Array.isArray(tags)
      ? tags.map((t) => t.trim()).filter(Boolean)
      : typeof tags === "string"
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

    const recipe = new Recipe({
      title: title.trim(),
      slug,
      description: description.trim(),
      content: content.trim(),
      image: image.trim(),
      author: userId,
      authorName,
      category: category.trim() || "General",
      tags: formattedTags,
      cookTime: cookTime.trim(),
      prepTime: prepTime.trim(),
      servings: Number(servings) || 4,
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      steps: Array.isArray(steps)
        ? steps
            .map((s) => (typeof s === "string" ? s.trim() : s))
            .filter(Boolean)
        : [],
      published: true,
    });

    await recipe.save();

    res.status(201).json({
      message: "Recipe created successfully",
      recipe,
    });
  } catch (error) {
    console.error("createRecipe error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
};

// PUT /api/recipes/:id
// Protected — update a recipe post (author or admin only)
export const updateRecipe = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const recipe = await Recipe.findById(id);

    if (!recipe) {
      return res.status(404).json({ error: "Not Found", message: "Recipe not found" });
    }

    // Check ownership or admin privilege
    if (recipe.author.toString() !== userId && userRole !== "admin") {
      return res.status(403).json({ error: "Forbidden", message: "You can only edit your own recipes" });
    }

    const {
      title,
      description,
      content,
      image,
      category,
      tags,
      cookTime,
      prepTime,
      servings,
      ingredients,
      steps,
    } = req.body;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: "Validation", message: "Title cannot be empty" });
      }
      recipe.title = title.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({ error: "Validation", message: "Description cannot be empty" });
      }
      recipe.description = description.trim();
    }

    if (content !== undefined) recipe.content = content.trim();
    if (image !== undefined) recipe.image = image.trim();
    if (category !== undefined) recipe.category = category.trim() || "General";
    if (cookTime !== undefined) recipe.cookTime = cookTime.trim();
    if (prepTime !== undefined) recipe.prepTime = prepTime.trim();
    if (servings !== undefined) recipe.servings = Number(servings) || 4;

    if (tags !== undefined) {
      recipe.tags = Array.isArray(tags)
        ? tags.map((t) => t.trim()).filter(Boolean)
        : typeof tags === "string"
        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
    }

    if (ingredients !== undefined) {
      recipe.ingredients = Array.isArray(ingredients) ? ingredients : [];
    }

    if (steps !== undefined) {
      recipe.steps = Array.isArray(steps)
        ? steps.map((s) => (typeof s === "string" ? s.trim() : s)).filter(Boolean)
        : [];
    }

    await recipe.save();

    res.status(200).json({
      message: "Recipe updated successfully",
      recipe,
    });
  } catch (error) {
    console.error("updateRecipe error:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
};

// DELETE /api/recipes/:id
// Protected — delete a recipe post (author or admin only)
export const deleteRecipe = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const recipe = await Recipe.findById(id);

    if (!recipe) {
      return res.status(404).json({ error: "Not Found", message: "Recipe not found" });
    }

    // Check ownership or admin privilege
    if (recipe.author.toString() !== userId && userRole !== "admin") {
      return res.status(403).json({ error: "Forbidden", message: "You can only delete your own recipes" });
    }

    // Delete comments associated with this recipe
    await Comment.deleteMany({ recipe: id });

    // Delete recipe
    await Recipe.findByIdAndDelete(id);

    res.status(200).json({
      message: "Recipe deleted successfully",
      recipeId: id,
    });
  } catch (error) {
    console.error("deleteRecipe error:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
};
