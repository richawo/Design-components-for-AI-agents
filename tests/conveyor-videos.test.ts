import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { conveyorVideoHash, conveyorVideoManifest } from "../scripts/lib/conveyor-videos.mjs";
it("only publishes a derivative matching the original recording", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "conveyor-video-"));
  try {
    fs.mkdirSync(path.join(root, "public/previews"), { recursive: true });
    fs.mkdirSync(path.join(root, "public/conveyor-previews"));
    const master = path.join(root, "public/previews/example.mp4");
    const bytes = Buffer.from("original recording");
    fs.writeFileSync(master, bytes);
    const name = `example.${conveyorVideoHash(bytes)}.mp4`;
    expect(conveyorVideoManifest(root, ["example", "../outside"])).toEqual({});
    fs.writeFileSync(path.join(root, "public/conveyor-previews", name), "encoded derivative");
    expect(conveyorVideoManifest(root, ["example"])).toEqual({ example: `/conveyor-previews/${name}` });
    fs.writeFileSync(master, "new recording");
    expect(conveyorVideoManifest(root, ["example"])).toEqual({});
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

it("keeps styled conveyor pixels separate and requires the matching full-size take", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "styled-conveyor-video-"));
  try {
    const directory = path.join(root, "public/style-previews/crayon");
    fs.mkdirSync(path.join(directory, "conveyor"), { recursive: true });
    const bytes = Buffer.from("Crayon recording"), name = `example.${conveyorVideoHash(bytes, { visualStyle: "crayon" })}.mp4`;
    expect(conveyorVideoHash(bytes, { visualStyle: "crayon" })).not.toBe(conveyorVideoHash(bytes));
    fs.writeFileSync(path.join(directory, "example.mp4"), bytes);
    fs.writeFileSync(path.join(directory, "conveyor", name), "styled derivative");
    expect(conveyorVideoManifest(root, ["example"])).toEqual({});
    expect(conveyorVideoManifest(root, ["example"], { visualStyle: "crayon" })).toEqual({ example: `/style-previews/crayon/conveyor/${name}` });
    fs.writeFileSync(path.join(directory, "example.mp4"), "new Crayon recording");
    expect(conveyorVideoManifest(root, ["example"], { visualStyle: "crayon" })).toEqual({});
    expect(() => conveyorVideoManifest(root, ["example"], { visualStyle: "../secret" })).toThrow("Invalid conveyor visual style");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

it("fingerprints each Crayon theme against its own master",()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"dark-conveyor-"));
 try{
  const directory=path.join(root,"public/style-previews/crayon/dark");fs.mkdirSync(path.join(directory,"conveyor"),{recursive:true});
  const bytes=Buffer.from("dark recording");fs.writeFileSync(path.join(directory,"example.mp4"),bytes);
  const name=`example.${conveyorVideoHash(bytes,{visualStyle:"crayon"})}.mp4`;fs.writeFileSync(path.join(directory,"conveyor",name),"dark derivative");
  expect(conveyorVideoManifest(root,["example"],{visualStyle:"crayon",theme:"dark"})).toEqual({example:`/style-previews/crayon/dark/conveyor/${name}`});
  expect(conveyorVideoManifest(root,["example"],{visualStyle:"crayon",theme:"light"})).toEqual({});
  fs.writeFileSync(path.join(directory,"example.mp4"),"new dark recording");expect(conveyorVideoManifest(root,["example"],{visualStyle:"crayon",theme:"dark"})).toEqual({});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
