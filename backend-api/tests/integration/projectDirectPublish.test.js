const request = require("supertest");
const bcrypt = require("bcrypt");
const app = require("../../index");
const User = require("../../models/user");
const Project = require("../../models/Project");

const COMPLETE = {
  title: "Poulailler communautaire",
  description: "Un élevage partagé pour le quartier.",
  objective: "Améliorer l’alimentation locale.",
  category: "Agriculture",
  country: "Cameroun",
  city: "Douala",
};

async function account(username) {
  const hash = await bcrypt.hash("Secret123!", 10);
  await User.create({
    firstName: "Amina",
    lastName: "Diallo",
    username,
    email: `${username}@example.com`,
    password: hash,
    roles: ["acheteur"],
    isSeller: false,
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: `${username}@example.com`, password: "Secret123!" });
  return login.headers["set-cookie"];
}

describe("direct project publication", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-auth";
  });

  it("rejects an incomplete publication before creating a project", async () => {
    const owner = await account("direct-incomplete");
    const before = await Project.countDocuments();
    const rejected = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({
        title: "Brouillon",
        publish: true,
        stages: [{ title: "Préparer", needs: [] }],
      });

    expect(rejected.status).toBe(422);
    expect(rejected.body.error.code).toBe("PUBLICATION_INCOMPLETE");
    expect(rejected.body.error.fields).toEqual(
      expect.arrayContaining(["description", "objective", "category", "country", "city"])
    );
    expect(await Project.countDocuments()).toBe(before);

    const anonymous = await request(app).post("/api/projects").send({ ...COMPLETE, publish: true });
    expect(anonymous.status).toBe(401);
    expect(await Project.countDocuments()).toBe(before);
  });

  it("publishes a new project with its stages and needs in one request", async () => {
    const owner = await account("direct-publish");
    const other = await account("direct-other");
    const created = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({
        ...COMPLETE,
        summary: "Un lieu partagé",
        publish: true,
        stages: [
          {
            title: "Préparer l’atelier",
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
        ],
      });

    expect(created.status).toBe(201);
    expect(created.body.project.status).toBe("published");
    expect(created.body.project.visibility).toBe("public");
    expect(created.body.project.ownerId).toBeUndefined();
    expect(created.body.project.stages).toHaveLength(1);
    expect(created.body.project.stages[0].title).toBe("Préparer l’atelier");
    expect(created.body.project.stages[0].needs).toHaveLength(1);
    expect(created.body.project.stages[0].needs[0].kind).toBe("skill");

    const id = created.body.project.id;
    const stored = await Project.find({ ownerId: { $exists: true } });
    const owned = stored.filter((project) => String(project._id) === id);
    expect(owned).toHaveLength(1);
    expect(owned[0].stages[0].needs).toHaveLength(1);

    const visible = await request(app).get(`/api/projects/${id}`);
    expect(visible.status).toBe(200);
    expect(visible.body.project.ownerId).toBeUndefined();
    expect(visible.body.project.stages[0].needs[0].title).toBe("Conseil");

    const forbidden = await request(app).get(`/api/projects/mine/${id}`).set("Cookie", other);
    expect(forbidden.status).toBe(403);
  });

  it("keeps a draft with prepared stages private", async () => {
    const owner = await account("direct-draft");
    const other = await account("direct-draft-other");
    const created = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({
        title: "Encore incomplet",
        publish: false,
        stages: [
          {
            title: "Première étape",
            needs: [
              {
                title: "Bois",
                kind: "resource",
                status: "open",
                description: "",
              },
            ],
          },
        ],
      });

    expect(created.status).toBe(201);
    expect(created.body.project.status).toBe("draft");
    expect(created.body.project.visibility).toBe("private");
    const id = created.body.project.id;
    expect(created.body.project.stages[0].needs[0].title).toBe("Bois");

    const hidden = await request(app).get(`/api/projects/${id}`);
    expect(hidden.status).toBe(404);
    const forbidden = await request(app).get(`/api/projects/mine/${id}`).set("Cookie", other);
    expect(forbidden.status).toBe(403);
    const ownerView = await request(app).get(`/api/projects/mine/${id}`).set("Cookie", owner);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.project.stages).toHaveLength(1);
  });

  it("does not persist a project when a prepared need is invalid", async () => {
    const owner = await account("direct-invalid-need");
    const before = await Project.countDocuments();
    const rejected = await request(app)
      .post("/api/projects")
      .set("Cookie", owner)
      .send({
        ...COMPLETE,
        publish: true,
        stages: [
          {
            title: "Préparer",
            needs: [{ title: "Aide", kind: "service", status: "blocked" }],
          },
        ],
      });

    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe("BLOCKER_EXPLANATION_REQUIRED");
    expect(await Project.countDocuments()).toBe(before);
  });
});
