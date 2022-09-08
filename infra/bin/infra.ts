#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';
import { AwsSolutionsChecks } from 'cdk-nag'
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();
new InfraStack(app, 'ExpoOktaDemoStack', {});

Aspects.of(app).add(new AwsSolutionsChecks({verbose:true}))
