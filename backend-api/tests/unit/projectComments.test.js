const {
  COMMENT_ACCESS,
  PROJECT_STATUS,
  PROJECT_VISIBILITY,
} = require("../../models/Project");
const {
  COMMENT_AUTHOR_TYPE,
  COMMENT_TARGET,
} = require("../../models/ProjectComment");
const {
  resolveCommentAccess,
  findNeedInProject,
  COMMENT_LIMIT,
} = require("../../services/projectCommentService");
const { ProjectError, editableProjectUpdate } = require("../../services/projectService");

describe("project comment rules", () => {
  it("defaults missing commentAccess to members only", () => {
    expect(resolveCommentAccess({})).toBe(COMMENT_ACCESS.MEMBERS);
    expect(resolveCommentAccess({ commentAccess: "members" })).toBe(COMMENT_ACCESS.MEMBERS);
    expect(resolveCommentAccess({ commentAccess: "everyone" })).toBe(COMMENT_ACCESS.EVERYONE);
  });

  it("accepts commentAccess on editable updates and rejects invalid values", () => {
    expect(
      editableProjectUpdate({ commentAccess: COMMENT_ACCESS.EVERYONE }, {})
    ).toEqual({ commentAccess: COMMENT_ACCESS.EVERYONE });
    expect(() => editableProjectUpdate({ commentAccess: "public" }, {})).toThrow(ProjectError);
  });

  it("locates needs only inside the owning project stages", () => {
    const needId = "507f1f77bcf86cd799439011";
    const otherNeed = "507f1f77bcf86cd799439012";
    const project = {
      stages: [
        {
          _id: "507f1f77bcf86cd799439013",
          needs: [{ _id: needId, title: "Compost" }],
        },
      ],
    };
    expect(findNeedInProject(project, needId)?.need.title).toBe("Compost");
    expect(findNeedInProject(project, otherNeed)).toBeNull();
    expect(findNeedInProject(project, "not-an-id")).toBeNull();
  });

  it("keeps comment constants aligned with persisted enums", () => {
    expect(COMMENT_LIMIT).toBe(2000);
    expect(Object.values(COMMENT_AUTHOR_TYPE)).toEqual(["member", "visitor"]);
    expect(Object.values(COMMENT_TARGET)).toEqual(["project", "need"]);
    expect(PROJECT_STATUS.PUBLISHED).toBe("published");
    expect(PROJECT_VISIBILITY.PUBLIC).toBe("public");
  });
});
