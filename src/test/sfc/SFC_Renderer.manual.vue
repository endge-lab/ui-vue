<script setup lang="ts">
import type { RComponentSFC_IR } from '@endge/core'
import { compileComponentSFCExpression } from '@endge/core'
import SFC_Renderer from '@/ui/render/sfc/SFC_Renderer.vue'

const ir: RComponentSFC_IR = {
  version: 2,
  script: {
    props: [],
    locals: [],
    ports: {
      require: { computations: [], components: [], actions: [], queries: [] },
      provides: { actions: [] },
      emits: { events: [] },
      forward: { rules: [] },
    },
    portCalls: [],
  },
  template: {
    roots: [
      {
        id: 'root',
        kind: 'element',
        tag: 'Flex',
        props: {
          col: { kind: 'literal', value: true },
          gap: { kind: 'literal', value: '2' },
          p: { kind: 'literal', value: '4' },
        },
        directives: {},
        children: [
          {
            id: 'status-row',
            kind: 'element',
            tag: 'Flex',
            props: {
              row: { kind: 'literal', value: true },
              gap: { kind: 'literal', value: '2' },
              align: { kind: 'literal', value: 'center' },
            },
            directives: {},
            children: [
              {
                id: 'dot',
                kind: 'element',
                tag: 'Dot',
                props: {
                  tone: compileComponentSFCExpression('flight.statusTone').value,
                },
                directives: {},
                children: [],
              },
              {
                id: 'badge',
                kind: 'element',
                tag: 'Badge',
                props: {
                  tone: compileComponentSFCExpression('flight.statusTone').value,
                },
                directives: {},
                children: [
                  {
                    id: 'status',
                    kind: 'expression',
                    value: compileComponentSFCExpression('flight.status').value,
                  },
                ],
              },
            ],
          },
          {
            id: 'route',
            kind: 'element',
            tag: 'Text',
            props: {},
            directives: {
              if: compileComponentSFCExpression('!compact').value,
            },
            children: [
              {
                id: 'route-value',
                kind: 'expression',
                value: compileComponentSFCExpression('flight.route').value,
              },
            ],
          },
          {
            id: 'passengers',
            kind: 'element',
            tag: 'Text',
            props: {},
            directives: {
              for: {
                item: 'passenger',
                index: 'index',
                source: compileComponentSFCExpression('passengers').value,
              },
            },
            children: [
              {
                id: 'passenger-name',
                kind: 'expression',
                value: compileComponentSFCExpression('passenger.name').value,
              },
            ],
          },
          {
            id: 'nested',
            kind: 'element',
            tag: 'Component',
            props: {
              is: { kind: 'literal', value: 'flight-actions' },
              flight: compileComponentSFCExpression('flight').value,
            },
            directives: {},
            children: [],
          },
        ],
      },
    ],
  },
  style: null,
}

const props = {
  flight: {
    status: 'Boarding',
    statusTone: 'success',
    route: 'SVO -> LED',
  },
  compact: false,
  passengers: [
    { name: 'Passenger A' },
    { name: 'Passenger B' },
  ],
}
</script>

<template>
  <SFC_Renderer
    :ir="ir"
    :props="props"
  />
</template>
