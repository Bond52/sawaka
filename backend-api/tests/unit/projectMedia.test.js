const { ownerProjectView } = require("../../services/projectService");

describe("project media views", () => {
  it("returns image URLs and never the storage identifier", () => {
    const view = ownerProjectView({
      _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      title: "Atelier",
      summary: "",
      description: "",
      objective: "",
      category: "",
      country: "",
      city: "",
      status: "draft",
      visibility: "private",
      stages: [
        {
          _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
          title: "Préparer",
          description: "",
          position: 0,
          status: "not_started",
          blockerExplanation: "",
          needs: [],
          images: [
            {
              _id: "cccccccccccccccccccccccc",
              url: "https://res.cloudinary.com/demo/stage.jpg",
              publicId: "secret-stage",
            },
          ],
        },
      ],
      coverImage: {
        _id: "dddddddddddddddddddddddd",
        url: "https://res.cloudinary.com/demo/cover.jpg",
        publicId: "secret-cover",
      },
      images: [],
    });

    expect(view.coverImage).toEqual({
      id: "dddddddddddddddddddddddd",
      url: "https://res.cloudinary.com/demo/cover.jpg",
    });
    expect(view.stages[0].images).toEqual([
      { id: "cccccccccccccccccccccccc", url: "https://res.cloudinary.com/demo/stage.jpg" },
    ]);
    expect(JSON.stringify(view)).not.toMatch(/secret-cover|secret-stage|publicId/);
  });
});
