---
title: Constraints
created_at: 2025-09-30
updated_at: 2025-09-30
category: DSA
subcategory: Introduction
---

# 📌 Task Constraints

## Why Constraints Matter
Before jumping into code, the very first step in solving any algorithm problem is to **understand the constraints**.  

A problem without clear constraints is ill-defined. For example:  
- Sorting **50 numbers** is very different from sorting **5 billion strings**, each one 1 million characters long.  
- If someone simply asks: *“Design an algorithm that sorts an array”*, you should **not start coding right away**.  
Instead, you need to ask:  
- What’s inside the array?  
- How large can the array be?  
- Are there special cases to consider?  

Constraints tell you how efficient your solution needs to be.

---

## Interview Reality
In interviews, constraints are not always clearly stated.  
👉 Interviewers often expect **you to ask clarifying questions**.  

This is actually an opportunity to show that you can:  
- Think critically about the problem  
- Identify missing details  
- Ensure your solution is correct and efficient  

Never assume something silently — **ask instead**.

---

## How to Ask the Right Questions
Think about everything that could affect your solution. For example:  
- Minimum and maximum possible values of key inputs  
- Maximum size of arrays or strings  
- Possible ranges of data (numbers, chars, geometric shapes, etc.)  
- Special rules (e.g., can the graph have negative weights? can the robot move diagonally?)  

Some of these questions will come naturally right after reading the problem.  
Others might come up while designing your solution (for example, if your algorithm’s complexity depends on input size).

💡 **Tip:** If a value affects performance or correctness, ask about it!

---

## Using the Canvas
The **Algorithm Design Canvas** has a dedicated section for **Constraints**.  

By practicing with it, you’ll get into the habit of always checking constraints before diving into ideas. This ensures you don’t waste time on an inefficient or invalid approach.

Filling in the **Constraints box** is essentially asking:  
- What do I know for sure?  
- What do I still need to clarify?  

---

## Helpful Resource
We’ve compiled a list of the most [**common interview constraints**](./the-common-constraints-handout.pdf) in the *Common Constraints Handout (PDF)*.  
👉 Print it and keep it handy while practicing.  

It will help you quickly spot what’s important in most problems.  
Of course, real practice with actual problems is the best way to build experience.

---

## Example
In the ZigZag problem (our running example), we apply this thinking to identify constraints.  


**“1-element subsequences are ZigZag.”**

---

## ▶️ What’s Next?
Once we’ve gathered all the necessary constraints, the next step is to explore[ **strategies for generating solution ideas**](../Ideas/README.md).
