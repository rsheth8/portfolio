import assert from "node:assert/strict";
import test from "node:test";
import { allProjects, profile, projectGroups } from "../data/site";

test("portfolio project data is complete and uniquely addressable", () => {
  assert.equal(projectGroups.length, 3);
  assert.ok(allProjects.length >= 9);

  const names = allProjects.map((project) => project.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, "project names must be unique");

  for (const project of allProjects) {
    assert.ok(project.name.trim(), "every project needs a name");
    assert.ok(project.label.trim(), `${project.name} needs a type label`);
    assert.ok(project.blurb.length >= 60, `${project.name} needs a useful blurb`);
    assert.ok(project.proof.trim(), `${project.name} needs a proof point`);
    assert.ok(project.tech.length >= 3, `${project.name} needs at least 3 tech tags`);
    assert.match(project.repo, /^https:\/\/github\.com\/rsheth8\//);
    if (project.demo) assert.match(project.demo, /^https:\/\//);
  }
});

test("profile and project groups expose valid navigation data", () => {
  assert.match(profile.email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  assert.match(profile.github, /^https:\/\/github\.com\//);
  assert.match(profile.linkedin, /^https:\/\/www\.linkedin\.com\//);

  const ids = projectGroups.map((group) => group.id);
  assert.equal(new Set(ids).size, ids.length, "section ids must be unique");
  for (const group of projectGroups) {
    assert.ok(group.projects.length >= 3, `${group.role} needs at least 3 projects`);
  }
});
