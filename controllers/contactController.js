const Contact = require("../models/Contact");

// ================= CREATE CONTACT =================
exports.createContact = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      service,
      message,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !service ||
      !message
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const contact = await Contact.create({
      firstName,
      lastName,
      email,
      phone,
      service,
      message,
    });

    res.status(201).json({
      success: true,
      message: "Contact created successfully",
      data: contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ALL CONTACTS =================
exports.getAllContacts = async (req, res) => {
  try {
    const paginated = ["page", "limit", "search", "service"]
      .some((key) => Object.prototype.hasOwnProperty.call(req.query, key));
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
    const search = typeof req.query.search === "string"
      ? req.query.search.trim().slice(0, 100)
      : "";
    const service = typeof req.query.service === "string"
      ? req.query.service.trim().slice(0, 100)
      : "";
    const filter = {};

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { service: searchRegex },
      ];
    }

    if (service && service.toLowerCase() !== "all") {
      filter.service = new RegExp(
        `^${service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      );
    }

    let contactsQuery = Contact.find(filter).sort({ createdAt: -1, _id: -1 });
    if (paginated) {
      contactsQuery = contactsQuery
        .skip((page - 1) * limit)
        .limit(limit);
    }

    const [contacts, total, services] = await Promise.all([
      contactsQuery.lean(),
      Contact.countDocuments(filter),
      Contact.distinct("service"),
    ]);

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
      services: [...new Set(services.map((value) => value.toLowerCase()))]
        .sort((a, b) => a.localeCompare(b)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET SINGLE CONTACT =================
exports.getSingleContact = async (req, res) => {
  try {
    const contact = await Contact.findById(
      req.params.id
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE CONTACT =================
exports.updateContact = async (req, res) => {
  try {
    const updatedContact =
      await Contact.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!updatedContact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact updated successfully",
      data: updatedContact,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DELETE CONTACT =================
exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(
      req.params.id
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
      });
    }

    await Contact.findByIdAndDelete(
      req.params.id
    );

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};