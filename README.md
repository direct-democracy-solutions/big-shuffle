# Big Shuffle

Linear-time shuffling of large datasets for Node.js

## About

This package uses the [Rao](https://www.jstor.org/stable/25049166)
algorithm to shuffle data sets that are too large to fit in memory. The
algorithm is described pretty well by [Chris Hardin](https://blog.janestreet.com/how-to-shuffle-a-big-dataset/).
In essence, the input stream is randomly scattered into "piles" which
are stored on disk. Then each pile is shuffled in-memory with
[Fisher-Yates](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle).

If your data set is extremely large, then even your piles may not fit in
memory. In that case, the algorithm could recurse until the piles are
small enough, but that feature is not implemented here.
