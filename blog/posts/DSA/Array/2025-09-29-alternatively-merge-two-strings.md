---
title: Alternatively Merge two Strings
created_at: 2025-09-29
updated_at: 2026-05-08
category: DSA
subcategory: Array
---

# Two Sum

**Difficulty:** Easy  
**Topics:** `Array` `Hash Map`

---

## Problem

Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.

You may assume that each input has exactly one solution, and you may not use the same element twice. You can return the answer in any order.

---

## Examples

**Example 1:**
```
Input:  nums = [2, 7, 11, 15], target = 9
Output: [0, 1]
Explanation: nums[0] + nums[1] = 2 + 7 = 9
```

**Example 2:**
```
Input:  nums = [3, 2, 4], target = 6
Output: [1, 2]
```

**Example 3:**
```
Input:  nums = [3, 3], target = 6
Output: [0, 1]
```

---

## Constraints

- `2 <= nums.length <= 10⁴`
- `-10⁹ <= nums[i] <= 10⁹`
- `-10⁹ <= target <= 10⁹`
- Only one valid answer exists

---

## Solution 1 — Brute Force

### Intuition

The simplest approach is to check every pair of numbers in the array. For each element, we look at every other element and check if the two sum to the target. No extra space needed but we pay a time cost.

### Algorithm

1. Loop through each element `i` in the array
2. For each `i`, loop through every element `j` after it
3. If `nums[i] + nums[j] == target`, return `[i, j]`

### Complexity

- **Time:** O(n²) — nested loops over the array
- **Space:** O(1) — no extra data structures

### Go

```go
func twoSum(nums []int, target int) []int {
    for i := 0; i < len(nums); i++ {
        for j := i + 1; j < len(nums); j++ {
            if nums[i]+nums[j] == target {
                return []int{i, j}
            }
        }
    }
    return nil
}
```

### Python

```python
def twoSum(nums: list[int], target: int) -> list[int]:
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
```

---

## Solution 2 — Optimal

`Hash Map`

### Intuition

Instead of checking every pair, we can use a hash map to remember numbers we've already seen. For each number, we calculate its complement (`target - num`) and check if we've seen it before. If yes — we found our pair. This brings us down to a single pass through the array.

### Algorithm

1. Create an empty hash map `seen` — stores `{number: index}`
2. Loop through each element with its index
3. Calculate `complement = target - nums[i]`
4. If `complement` exists in `seen` — return `[seen[complement], i]`
5. Otherwise store `nums[i]` in `seen` with its index
6. Continue until found

### Complexity

- **Time:** O(n) — single pass through the array
- **Space:** O(n) — hash map stores up to n elements

### Go

```go
func twoSum(nums []int, target int) []int {
    seen := make(map[int]int)

    for i, num := range nums {
        complement := target - num
        if j, ok := seen[complement]; ok {
            return []int{j, i}
        }
        seen[num] = i
    }

    return nil
}
```

### Python

```python
def twoSum(nums: list[int], target: int) -> list[int]:
    seen = {}

    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
```

---

## Key Takeaway

The brute force checks every pair — O(n²). The optimal solution trades space for time — by storing what we've seen in a hash map, we reduce to O(n). This is a classic time-space tradeoff and a pattern that appears constantly in interview problems.
any change again
---

## Video Explanation

<!-- paste your YouTube embed here once recorded -->