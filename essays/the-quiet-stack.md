---
slug: the-quiet-stack
title: The Quiet Stack
date: 2026-08-08
tags: [software, web, simplicity]
excerpt: A short defense of the boring stack — and why the best web pages are made of HTML, CSS, and a single JavaScript file.
---

The best websites I use are made of HTML, CSS, and a single JavaScript file.

That's not a hot take. It's a description. Most of what I read, buy, and return to is built that way — or close enough. The page loads. The page works. The page doesn't talk back.

## What we replaced boredom with

For a while, we replaced boring tech with interesting tech. Frameworks, build pipelines, hydration, islands, server components. The reasons were good: we wanted better interactivity, faster iteration, safer refactors. And we got them.

Then we kept going. We replaced interesting tech with complicated tech. We replaced the build pipeline with three build pipelines. We replaced "this page works" with "this page works once the cache has warmed up."

> Complexity is a tax on every future change. Every person who joins the team pays it. Every feature you don't ship, you paid it.

## The boring alternative

A static site. Markdown for content. A CSS file you can read. A JavaScript file that does one thing — usually fetch a manifest, render a list, wire up a theme toggle. No bundler. No `node_modules` to delete when something breaks. No `npm audit fix --force`.

The boring stack is not the simplest possible stack. It's the stack where the surface area matches the problem. For a personal site, that's a folder of files.

## The hard part

The hard part of the boring stack isn't writing it. It's *not adding things*. Every time you want to "just" add a component library, ask: what does this buy me that a 30-line script doesn't? Usually nothing. Usually less.

The boring stack is a posture, not a default. You have to keep choosing it.
