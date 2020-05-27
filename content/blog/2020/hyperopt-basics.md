+++
title = "Hyperopt Basics"
author = ["Dmitry Kabanov"]
date = 2020-03-12T15:16:00+01:00
tags = ["howto", "hyperopt"]
draft = false
+++

This is an introduction to using Hyperopt library.

This library is used to choose the hyperparameters, that is the parameters of
the model that is chosen to estimate the data.
This is \\(\R\\).
For example, when you find your model by optimizing function
\\[
  \frac{1}{N} \sum\_{i=1}^N \left( y\_i - \hat f (x\_i) \right)^2 + \lambda R(f),
\\]

then \\(\lambda\\) is a hyperparameter that must be chosen before the optimization.


## Overall algorithm of using Hyperopt {#overall-algorithm-of-using-hyperopt}

Optimization of the hyperparameters in Hyperopt consists of three steps:

1.  Define an objective function that numerically measures the quality of the
    given set of hyperparameters.
2.  Define hyperparameters space.
3.  Call function \`hyperopt.fmin\` that will find optimal set of hyperparameters
    given objective function and hyperparameter space.


## Defining objective function {#defining-objective-function}

The simplest way to define an objective function is the following:

```python
def objective(params):
    # expand params, for example:
    alpha, beta = params
    # evaluate some nonnegative function `loss` using params
    loss = alpha**2 + beta**2

    return loss
```


## Defining parameter space {#defining-parameter-space}

Hyperparameter space is defined using utility module \`hp\`.
For each parameter, we can specify which distribution it has.

For example, the following code specifies that variable
\\(\alpha \sim \uniform(-2, 5)\\) while \\(\beta \sim \normal(0, 3^2)\\):

```python
params_space = [
  hyperopt.hp.uniform('alpha', -2, 5),
  hyperopt.hp.normal('beta', 0, 3),
]
```


## Running hyperparameter optimization {#running-hyperparameter-optimization}

Now we are ready to optimize hyperparameters. For that, we use function
\`hyperopt.fmin\` which accepts objective function and parameter space.
Besides that, we need to specify the algorithm that we use, and how many trials
we would like to run:

```python
params_star = hyperopt.fmin(
    objective,
    params_space,
    algo=hyperopt.tpe.suggest
)
```

That's it! This was an introduction to the optimization of hyperparameters using
Hyperopt library.

This tutorial is based on the paper:
<https://conference.scipy.org/proceedings/scipy2013/pdfs/bergstra%5Fhyperopt.pdf>
