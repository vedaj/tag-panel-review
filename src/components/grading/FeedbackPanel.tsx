import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { MessageSquare } from 'lucide-react'
import { feedbackKey } from '@/lib/utils'
import type { Group, Student, FeedbackMap } from '@/types/database'

const ROLL_PREFIX = 'CB.SC.U4CSE'
function shortRoll(r: string) { return r.startsWith(ROLL_PREFIX) ? r.slice(ROLL_PREFIX.length) : r }
function toTitleCase(name: string) {
  return name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export function FeedbackPanel({
  group,
  students,
  feedbacks,
  show,
  onToggle,
  onChange,
}: {
  group: Group
  students: Student[]
  feedbacks: FeedbackMap
  show: boolean
  onToggle: () => void
  onChange: (key: string, value: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare size={18} /> Feedback
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {show ? '▾' : '▸'}
          </Button>
        </div>
      </CardHeader>
      {show && (
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Group Feedback</label>
            <Textarea
              placeholder="Any notes on the project or the group overall…"
              value={feedbacks[feedbackKey(group.id, null)] ?? ''}
              onChange={(e) => onChange(feedbackKey(group.id, null), e.target.value)}
              rows={3}
            />
          </div>
          <Separator />
          <div className="space-y-4">
            <p className="text-sm font-medium">Per-student feedback</p>
            {students.map((s) => (
              <div key={s.id}>
                <label className="text-sm text-muted-foreground mb-1.5 block">
                  {toTitleCase(s.name)} <span className="text-xs" title={s.roll_number}>({shortRoll(s.roll_number)})</span>
                </label>
                <Textarea
                  placeholder={`Feedback for ${toTitleCase(s.name).split(' ')[0]}…`}
                  value={feedbacks[feedbackKey(group.id, s.id)] ?? ''}
                  onChange={(e) => onChange(feedbackKey(group.id, s.id), e.target.value)}
                  rows={2}
                />
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
