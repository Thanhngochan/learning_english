import assert from "node:assert/strict";
import { analyse } from "../src/lib/pipeline.js";

const en = analyse("Students are learning. The student learned quickly, and learning helps students. Banks detect fraud; fraud detection matters.", "auto", 20);
assert.equal(en.lang, "eng");
assert.ok(!en.noStop.includes("the"));
const learn = en.sorted.find((e) => e.key === "learn");
assert.equal(learn.count, 3);
assert.ok(en.n >= 1 && en.covered <= en.total);

const vi = analyse("Sinh viên đang học cách dùng trí tuệ nhân tạo trong giảng dạy và nghiên cứu khoa học ở trường đại học.", "auto", 20);
assert.equal(vi.lang, "vie");
assert.ok(!vi.noStop.includes("và"));

const zh = analyse("大学正在学习如何在教学中使用人工智能，学生用人工智能来理解困难的概念。", "auto", 20);
assert.equal(zh.lang, "zho");
assert.ok(!zh.noStop.includes("的"));
console.log("pipeline tests passed");
