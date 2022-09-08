/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as iam from 'aws-cdk-lib/aws-iam';
import { IdentityPool } from '@aws-cdk/aws-cognito-identitypool-alpha';
import { NagSuppressions } from "cdk-nag";
import { OktaConfig } from '../config/okta-config';
import DemoBucket from './components/DemoBucket';

export interface s3Props {
  bucketName: string,
  logsBucketName: string,
  identityPool: IdentityPool
}

export class InfraStack extends Stack {
  public readonly openIdConnectProvider: iam.IOpenIdConnectProvider;
  public readonly identityPool: IdentityPool;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const okta = OktaConfig;
    this.openIdConnectProvider = new iam.OpenIdConnectProvider(this, 'OktaProvider', {
      url: okta.url,
      clientIds: [okta.client_id],
    });
    
    const identityPool = new IdentityPool(this, 'OktaIDP', {
      authenticationProviders: {
        openIdConnectProviders: [this.openIdConnectProvider],
      }
    });

    const demoBucket = new DemoBucket(this, 'DemoBucket', {
      bucketName: "my-mcdf-bucket",
      logsBucketName: "my-mcdf-logs-bucket",
      identityPool: identityPool
    });

  }
}
