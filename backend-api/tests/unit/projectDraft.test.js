const {
  ProjectError,
  editableProjectUpdate,
  isPubliclyReadable,
  publicProjectView,
  ownerProjectView,
  missingPublicationFields,
  pendingStageDocuments,
  splitCreateRequest,
} = require("../../services/projectService");

describe("project draft rules", () => {
  it("accepts an incomplete draft and trims allowlisted fields", () => {
    expect(editableProjectUpdate({ title: "  Poulailler  " })).toEqual({
      title: "Poulailler",
    });
    expect(editableProjectUpdate({})).toEqual({});
  });

  it("rejects lifecycle, ownership, and unknown fields", () => {
    expect(() =>
      editableProjectUpdate({
        title: "Poulailler",
        ownerId: "507f1f77bcf86cd799439011",
        status: "published",
        visibility: "public",
      })
    ).toThrow(ProjectError);

    try {
      editableProjectUpdate({ publishedAt: "2026-11-14" });
    } catch (err) {
      expect(err).toBeInstanceOf(ProjectError);
      expect(err.code).toBe("FIELD_NOT_ALLOWED");
      expect(err.fields).toEqual(["publishedAt"]);
      expect(err.status).toBe(400);
    }
  });

  it("rejects non-strings and values past the safe length", () => {
    expect(() => editableProjectUpdate({ city: 12 })).toThrow(ProjectError);
    try {
      editableProjectUpdate({ title: "a".repeat(121) });
    } catch (err) {
      expect(err.code).toBe("FIELD_TOO_LONG");
      expect(err.fields).toEqual(["title"]);
    }
  });

  it("keeps drafts out of the public view", () => {
    const draft = {
      _id: "507f1f77bcf86cd799439011",
      ownerId: "507f1f77bcf86cd799439012",
      title: "Privé",
      summary: "",
      description: "",
      objective: "",
      category: "",
      country: "",
      city: "",
      status: "draft",
      visibility: "private",
      publishedAt: null,
    };

    expect(isPubliclyReadable(draft)).toBe(false);
    expect(ownerProjectView(draft).visibility).toBe("private");
    expect(ownerProjectView(draft).id).toBe(draft._id);

    const published = {
      ...draft,
      status: "published",
      visibility: "public",
      publishedAt: new Date("2026-11-14T00:00:00.000Z"),
    };
    expect(isPubliclyReadable(published)).toBe(true);
    const publicView = publicProjectView(published);
    expect(publicView.ownerId).toBeUndefined();
    expect(publicView.visibility).toBeUndefined();
    expect(publicView.title).toBe("Privé");
    expect(missingPublicationFields({ ...draft, title: "" })).toEqual([
      "title",
      "description",
      "objective",
      "category",
      "country",
      "city",
    ]);
  });

  it("separates a direct publication request from project fields", () => {
    expect(splitCreateRequest({ title: "Atelier", publish: true, stages: [] })).toEqual({
      publish: true,
      stages: [],
      fields: { title: "Atelier" },
    });
    expect(() => splitCreateRequest({ publish: "yes" })).toThrow(ProjectError);
  });

  it("builds pending stages and needs without accepting extra fields", () => {
    const stages = pendingStageDocuments([
      {
        title: " Préparer ",
        description: "Réunir le matériel",
        status: "in_progress",
        needs: [
          {
            title: "Conseil",
            description: "Organiser l’espace",
            kind: "skill",
            status: "open",
          },
        ],
      },
    ]);
    expect(stages).toHaveLength(1);
    expect(stages[0].position).toBe(0);
    expect(stages[0].title).toBe("Préparer");
    expect(stages[0].needs[0].kind).toBe("skill");
    expect(stages[0].needs[0].title).toBe("Conseil");

    expect(() =>
      pendingStageDocuments([{ title: "Étape", ownerId: "507f1f77bcf86cd799439011" }])
    ).toThrow(ProjectError);
    try {
      pendingStageDocuments([
        {
          title: "Étape",
          needs: [{ title: "Aide", kind: "service", status: "blocked" }],
        },
      ]);
    } catch (err) {
      expect(err.code).toBe("BLOCKER_EXPLANATION_REQUIRED");
    }
  });
});
